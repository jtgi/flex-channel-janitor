import arg from 'arg';
import inquirer from 'inquirer'
import twilio from 'twilio'

const DEFAULT_CHAT_SERVICE = 'Flex Chat Service';
const DEFAULT_TASKROUTER_WORKSPACE = 'Flex Task Assignment';
const DEFAULT_PROXY_SERVICE = 'Flex Proxy Service';

export async function cli(args) {
    let { accountSid, authToken } = parseArgs();

    if (!accountSid || !authToken) {
        console.error('usage: flex-channel-janitor --account-sid ACxx --auth-token Eyxxk')
        return;
    }

    await cleanup(accountSid, authToken);
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
    const client = twilio(accountSid, authToken);

    const chatServices = await client.chat.services.list({ limit: 20 });
    const workspaces = await client.taskrouter.workspaces.list({ limit: 20 })
    const proxyServices = await client.proxy.services.list({ limit: 20 });

    const flexWorkspace = workspaces.find(ws => ws.friendlyName === DEFAULT_TASKROUTER_WORKSPACE);
    const flexChatService = chatServices.find(svc => svc.friendlyName === DEFAULT_CHAT_SERVICE);
    const flexProxyService = proxyServices.find(svc => svc.uniqueName === DEFAULT_PROXY_SERVICE);

    const tasks = await getAll(client.taskrouter.workspaces(flexWorkspace.sid).tasks);

    if (!tasks.length) {
        console.log('No tasks found. Nothing to do.');
        success();
    }

    const proxySessions = await getAll(client.proxy.services(flexProxyService.sid).sessions);
    if (!proxySessions) {
        console.log('No proxy sessions found. Nothing to do.');
        success();
    }

    console.log(proxySessions);
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

function success() {
    console.log('Complete');
    process.exit(0);
}