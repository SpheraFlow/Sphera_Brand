
import axios from 'axios';

const CLIENT_ID = 'c2c0ced2-ed69-4fd1-9edd-393965f39b3b';
const BASE_URL = 'http://localhost:3001/api';

async function runTestA() {
    console.log('🧪 Starting Test A: Happy Path (Quarterly Generation)');

    try {
        // 1. Trigger Generation
        console.log('1. Triggering generation...');
        const start = Date.now();
        // Correct Path: /api/calendar/generate-calendar
        const res = await axios.post(`${BASE_URL}/calendar/generate-calendar`, {
            clienteId: CLIENT_ID,
            periodo: 90, // Quarterly
            briefing: 'Teste automatizado trimestral',
            mes: 'Setembro 2026', // Future date to avoid conflicts
            monthsCount: 3,
            mix: { reels: 1, static: 1, carousel: 1, stories: 1, photos: 0 },
            generationPrompt: 'Teste smoke',
            monthReferences: ''
        });

        const duration = Date.now() - start;
        console.log(`   Response time: ${duration}ms`);

        if (res.status === 202 && res.data.jobId) {
            console.log(`   ✅ API responded 202 Accepted with jobId: ${res.data.jobId}`);
        } else {
            console.error('   ❌ Failed to trigger generation:', res.status, res.data);
            process.exit(1);
        }

        const jobId = res.data.jobId;

        // 2. Poll Status
        console.log('2. Polling job status...');
        let status = 'pending';
        let attempts = 0;

        while (status !== 'succeeded' && status !== 'failed' && attempts < 120) { // Increased checks for 3 months
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s
            const jobRes = await axios.get(`${BASE_URL}/jobs/${CLIENT_ID}/${jobId}`);
            const job = jobRes.data.job;

            status = job.status;
            // console.log(`   [${attempts * 2}s] Status: ${status}, Progress: ${job.progress}%, Step: ${job.current_step}`);
            process.stdout.write(`\r   [${attempts * 2}s] Status: ${status}, Progress: ${job.progress}%, Step: ${job.current_step}          `);

            if (status === 'failed') {
                console.error('\n   ❌ Job failed:', job.error);
                process.exit(1);
            }
            attempts++;
        }
        console.log(''); // New line

        if (status !== 'succeeded') {
            console.error('   ❌ Timeout waiting for job completion');
            process.exit(1);
        }

        console.log('   ✅ Job succeeded!');

        // 3. Verify Artifacts
        console.log('3. Verifying artifacts...');

        // Check Job Result
        const finalJobRes = await axios.get(`${BASE_URL}/jobs/${CLIENT_ID}/${jobId}`);
        const finalJob = finalJobRes.data.job;
        if (finalJob.result_calendar_ids && finalJob.result_calendar_ids.length > 0) {
            console.log(`   ✅ result_calendar_ids present: ${finalJob.result_calendar_ids.join(', ')}`);
        } else {
            console.error('   ❌ result_calendar_ids missing');
        }

        // Check Calendars (Published)
        // Path: /api/calendar/calendars/:clientId
        const monthsToCheck = ['Setembro 2026', 'Outubro 2026', 'Novembro 2026'];
        for (const m of monthsToCheck) {
            try {
                const calRes = await axios.get(`${BASE_URL}/calendar/calendars/${CLIENT_ID}`, { params: { month: m } });
                if (calRes.data.calendar && calRes.data.calendar.status === 'published') {
                    console.log(`   ✅ Calendar for ${m} exists and is PUBLISHED`);
                } else {
                    console.error(`   ❌ Calendar for ${m} not found or not published. Status: ${calRes.data.calendar?.status}`);
                }
            } catch (e: any) {
                console.error(`   ❌ Error fetching calendar for ${m}:`, e.message);
            }
        }

        // Check Available Months
        // Path: /api/presentation/available-months/:clientId
        try {
            const availRes = await axios.get(`${BASE_URL}/presentation/available-months/${CLIENT_ID}`);
            // Let's check presentation.ts
            // It returns res.json(result.rows); So it is an array.
            // Wait, review presentation.ts...
            // router.get('/available-months/:clienteId', async (req, res) => { request ... res.json(result.rows); });
            // So availableMonths IS the array.

            // Correcting extraction:
            const availableParams = Array.isArray(availRes.data) ? availRes.data : availRes.data.months || [];

            const allFound = monthsToCheck.every(m => availableParams.some((am: any) => am.mes === m));

            if (allFound) {
                console.log('   ✅ All generated months are listed in available-months');
            } else {
                console.error('   ❌ Not all months found in available-months. Found:', availableParams.map((m: any) => m.mes));
            }
        } catch (e: any) {
            console.error('   ❌ Error checking available months:', e.message);
        }

    } catch (err: any) {
        console.error('❌ Test failed with exception:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

runTestA();
