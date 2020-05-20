import chalk from 'chalk';

export async function getAll(resource) {
    const results = []; 

    let page = await resource.page();
    results.push(...page.instances);

    while (page.getNextPageUrl()) {
        page = await page.nextPage()
        results.push(...page.instances);
    }

    return results;
}

export function validateSid(str, prefix) {
    return new RegExp(`^${prefix}[a-z0-9]{32}$`).test(str);
}

export async function serially(list, promiseFactoryFn) {
    return list.reduce((chain, item) => chain.then(() => promiseFactoryFn(item)), Promise.resolve());
}

export async function batchProcess(list, promiseFactoryFn, batchSize) {
    let i = 0;
    let batch = list.slice(i, i + batchSize);

    while(batch.length) {
        try {
            await Promise.all(batch.map(promiseFactoryFn));
        } catch (err) {
            warn(`Failed while processing batch. ${err.message} Continuing...`);
        }

        i += batchSize;
        batch = list.slice(i, i + batchSize);
    }
}

export function warn(msg) {
    console.warn(`${chalk.yellow.bold('WARN')} ${msg}`)
    process.exit(1);
}

export function error(e) {
    console.error(`${chalk.red.bold('FAILED')} ${e.message} \n${e.stack}`)
    process.exit(1);
}

export function success(msg) {
    console.log(`${chalk.green.bold('DONE')} ${msg || ''}`); 
    process.exit(0);
}
