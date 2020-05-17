import twilio from 'twilio';
import Listr from 'listr';
import { batchProcess, validateSid, getAll, success } from './util';

const DEFAULT_CHAT_SERVICE = process.env.CHAT_SERVICE || 'Flex Chat Service';
const DEFAULT_TASKROUTER_WORKSPACE = process.env.TASKROUTER_WORKSPACE || 'Flex Task Assignment';
const DEFAULT_PROXY_SERVICE = process.env.PROXY_SERVICE || 'Flex Proxy Service';
const BATCH_SIZE = process.env.BATCH_SIZE || 10;

export default async function cleanup(accountSid, authToken) {
    const twlo = twilio(accountSid, authToken);
    const tasks = new Listr([
        {
            title: 'Fetch Flex resources',
            task: async ctx => store(ctx, await fetchFlexServices(twlo))
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

            updated++;
            status(`Clean up stale sessions. ${updated} completed`);
        }
    }, BATCH_SIZE);

    return {
        updated
    };
}
