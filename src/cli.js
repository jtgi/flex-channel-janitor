import arg from 'arg';
import cleanup from './cleanup';
import { success, error } from './util';

export async function cli(args) {
    let { accountSid, authToken } = parseArgs();
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

    if (!accountSid || !authToken) {
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
            accountSid = TWILIO_ACCOUNT_SID;
            authToken = TWILIO_AUTH_TOKEN;
        } else {
            console.error('usage: flex-channel-janitor --account-sid $account_sid --auth-token $token')
            return;
        }
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
