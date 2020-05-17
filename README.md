# Flex Channel Janitor
Cleans up any lingering Proxy sessions that have lost their associated tasks.

## Usage
Clone and run directly or install via npm.

### Via NPM
```sh
npm install -g flex-channel-janitor
flex-channel-janitor --account-sid <Twilio Account Sid> --auth-token <Twilio Auth Token>
```

### Via github
```sh
git clone https://github.com/jtgi/flex-channel-janitor.git
cd flex-channel-janitor
npm install
./bin/flex-channel-janitor
```


*Note:* If you want Flex to do this for you automatically just enable janitor on your Flex Flow. For more information see [here](https://www.twilio.com/docs/flex/api/flow#create-a-flex-flow-with-studio)
