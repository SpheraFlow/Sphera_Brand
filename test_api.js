const http = require('http');

http.get('http://localhost:3001/api/jobs/6cf139c5-2359-4cf7-8f2c-d2aa0fc6ad83', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        if (json.jobs && json.jobs.length > 0) {
            const jobId = json.jobs[0].id;
            console.log('Found jobId:', jobId);
            http.get(`http://localhost:3001/api/jobs/6cf139c5-2359-4cf7-8f2c-d2aa0fc6ad83/${jobId}`, (res2) => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => console.log('Job details:', JSON.parse(data2)));
            });
        } else {
            console.log('No jobs found for this client.');
        }
    });
}).on('error', err => console.error('Fetch error:', err.message));
