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

export async function batchProcess(list, promiseFactoryFn, batchSize) {
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

export function error(e) {
    console.error(`${chalk.red.bold('FAILED')} ${e.message} \n${e.stack}`)
}

export function success(msg) {
    console.log(`${chalk.green.bold('SUCCESS')} ${msg || ''}`); 
    process.exit(0);
}