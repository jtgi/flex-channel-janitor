import arg from 'arg';
import twilio from 'twilio';
import Listr from 'listr';
import chalk from 'chalk';

const DEFAULT_CHAT_SERVICE = 'Flex Chat Service';
const DEFAULT_TASKROUTER_WORKSPACE = 'Flex Task Assignment';
const DEFAULT_PROXY_SERVICE = 'Flex Proxy Service';
const BATCH_SIZE = 20;

export async function cli(args) {
    let { accountSid, authToken } = parseArgs();

    if (!accountSid || !authToken) {
        console.error('usage: flex-channel-janitor --account-sid ACxx --auth-token Eyxxk')
        return;
    }

    try {
        await cleanup(accountSid, authToken);
    } catch (err) {
        error(err);
    }

    success();
}

function parseArgs(rawArgs) {
    const args = arg({
        '--account-sid': String,
        '--auth-token': String,
    });
    
    return {
        accountSid: args['--account-sid'],
        authToken: args['--auth-token']
    }
}

async function cleanup(accountSid, authToken) {
    const twlo = twilio(accountSid, authToken);
    const tasks = new Listr([
        {
            title: 'Fetch Flex resources',
            task: async (ctx, task) => store(ctx, await fetchFlexServices(twlo))
        },
        {
            title: 'Find stale chat sessions',
            task: async ctx => store(
                ctx,
                await findStaleChatSessions(
                    twlo,
                    ctx.flex.flexWorkspace,
                    ctx.flex.flexProxyService
                )
            )
        },
        {
            title: 'Clean up stale sessions',
            skip: ctx => ctx.flex.orphanedChannelSids.length > 0 ? 'No stale chat sessions found!' : '',
            task: async ctx => store(
                ctx,
                await cleanupChatChannels(
                    status => task.title = status,
                    twlo,
                    ctx.flex.orphanedChannelSids,
                    ctx.flex.flexChatService
                )
            )
        },
    ]);
    
    return tasks.run();
}

function store(ctx, data) {
    // Must be prop on ctx or state is wiped
    // out between tasks :/
    ctx.flex = {
        ...ctx.flex,
        ...data
    }
}

async function fetchFlexServices(twlo) {
    const chatServices = await twlo.chat.services.list();
    const workspaces = await twlo.taskrouter.workspaces.list();
    const proxyServices = await twlo.proxy.services.list();

    const flexWorkspace = workspaces.find(ws => ws.friendlyName === DEFAULT_TASKROUTER_WORKSPACE);
    const flexChatService = chatServices.find(svc => svc.friendlyName === DEFAULT_CHAT_SERVICE);
    const flexProxyService = proxyServices.find(svc => svc.uniqueName === DEFAULT_PROXY_SERVICE);
    
    if (!flexWorkspace) { throw new Error('Unable to find Flex TaskRouter Workspace') }
    if (!flexChatService) { throw new Error('Unable to find Flex Chat Service') }
    if (!flexProxyService) { throw new Error('Unable to find Flex Proxy Service') }

    return {
        flexWorkspace: flexWorkspace.sid,
        flexChatService: flexChatService.sid,
        flexProxyService: flexProxyService.sid
    };
}

async function findStaleChatSessions(twlo, flexWorkspace, flexProxyService) {
    const allTasks = await getAll(twlo.taskrouter.workspaces(flexWorkspace).tasks);
    if (!allTasks.length) {
        success('No tasks found. Nothing to do.');
    }
    const taskChannelSids = allTasks.map(t => JSON.parse(t.attributes).channelSid).filter(sid => !!sid);

    const proxySessions = await getAll(twlo.proxy.services(flexProxyService).sessions);
    if (!proxySessions.length) {
        success('No proxy sessions found. Nothing to do.');
    }

    const proxyChannelSids = proxySessions
        .filter(s => validateSid(s.uniqueName, 'CH') && s.status.toLowerCase() !== 'closed')
        .map(s => s.uniqueName);

    const orphanedChannelSids = proxyChannelSids.filter(p => !taskChannelSids.some(t => t === p));

    return {
        orphanedChannelSids
    };
}

async function cleanupChatChannels(status, twlo, orphanedChannelSids, flexChatService) {
    let updated = 0;

    await batchProcess(orphanedChannelSids, async channelSid => {
        const channel = await twlo.chat.services(flexChatService).channels(channelSid).fetch();
        const attrs = JSON.parse(channel.attributes);
        if (attrs.status !== 'INACTIVE') {
            await twlo.chat.services(flexChatService).channels(channelSid).update({
                attributes: JSON.stringify({
                    ...attrs,
                    status: 'INACTIVE'
                })
            });

            status(`Clean up stale sessions. ${updated} completed`);
            updated++;
        }
    }, BATCH_SIZE);

    return {
        updated
    };
}

async function getAll(resource) {
    const results = []; 

    let page = await resource.page();
    results.push(...page.instances);

    while (page.getNextPageUrl()) {
        page = await page.nextPage()
        results.push(...page.instances);
    }

    return results;
}

function validateSid(str, prefix) {
    return new RegExp(`^${prefix}[a-z0-9]{32}$`).test(str);
}

async function batchProcess(list, promiseFactoryFn, batchSize) {
    let i = 0;
    let batch = list.slice(i, i + batchSize);

    while(batch.length) {
        try {
            await Promise.all(batch.map(promiseFactoryFn));
        } catch (err) {
            error('Failed while processing batch. Continuing...', err);
        }

        i += batchSize;
        batch = list.slice(i, i + batchSize);
    }
}

function error(e) {
    console.error(`${chalk.red.bold('FAILED')} ${e.message} \n${e.stack}`)
}

function success(msg) {
    console.log(`${chalk.green.bold('SUCCESS')} ${msg || ''}`); 
    process.exit(0);
}
