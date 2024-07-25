import fs from 'fs';
import fetch from 'node-fetch';
import cheerio from 'cheerio';
import ora from 'ora';
import readline from 'readline';

const base_url = 'https://openai.com/index/searchgpt-prototype/';
let running = true;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('SIGINT', () => {
    running = false;
    rl.close();
});

async function getPageContent(url) {
    try {
        const response = await fetch(url);
        const body = await response.text();
        return body;
    } catch (error) {
        console.error('Error fetching the webpage:', error);
        return '';
    }
}

async function getAllLinks(url, visited) {
    try {
        const response = await fetch(url);
        const body = await response.text();
        const $ = cheerio.load(body);

        let links = new Set();
        $('a').each((index, element) => {
            let link = $(element).attr('href');
            if (link) {
                if (link.startsWith('/')) {
                    link = base_url + link;
                }
                if (link.startsWith(base_url) && !visited.has(link)) {
                    links.add(link);
                }
            }
        });
        return links;
    } catch (error) {
        console.error('Error fetching or processing the webpage:', error);
        return new Set();
    }
}

async function main() {
    const spinner = ora('Starting content extraction').start();
    const visited = new Set();
    let to_visit = new Set([base_url]);
    let all_links = new Set();
    let all_content = []; // Array to store all content

    while (to_visit.size > 0 && running) {
        const current_url = to_visit.values().next().value;
        to_visit.delete(current_url);
        if (!visited.has(current_url)) {
            visited.add(current_url);
            spinner.text = `Extracting links from ${current_url}`;
            const links = await getAllLinks(current_url, visited);
            links.forEach(link => {
                if (!visited.has(link)) {
                    to_visit.add(link);
                }
                all_links.add(link);
            });

            // Extract content from the current URL
            const content = await getPageContent(current_url);
            all_content.push(`URL: ${current_url}\n\n${content}\n\n---\n\n`); // Append content to the array
        }
        // Pause to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Split content into 10 different files
    const filesCount = 1;
    const itemsPerFile = Math.ceil(all_content.length / filesCount);
    for (let i = 0; i < filesCount; i++) {
        const fileContent = all_content.slice(i * itemsPerFile, (i + 1) * itemsPerFile).join('\n');
        fs.writeFileSync(`content_part_${i + 1}.txt`, fileContent);
    }

    spinner.stop();
    console.log(`Total links extracted: ${all_links.size}`);
    console.log('All content extracted and saved to 10 separate files.');
}

main();
