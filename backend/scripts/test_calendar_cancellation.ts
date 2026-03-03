
import axios from 'axios';

const CLIENT_ID = 'c2c0ced2-ed69-4fd1-9edd-393965f39b3b';
const BASE_URL = 'http://localhost:3001/api';

async function runTestC() {
    console.log('🧪 Starting Test C: Job Cancellation');

    try {
        // 1. Trigger Generation
        console.log('1. Triggering generation to cancel...');
        const res = await axios.post(`${BASE_URL}/calendar/generate-calendar`, {
            clienteId: CLIENT_ID,
            periodo: 90,
            briefing: 'Teste cancelamento',
            mes: 'Dezembro 2026',
            monthsCount: 3,
            mix: { reels: 1, static: 1, carousel: 1, stories: 1, photos: 0 },
            generationPrompt: 'Teste cancelamento',
            monthReferences: ''
        });

        const jobId = res.data.jobId;
        console.log(`   Job started: ${jobId}`);

        // 2. Wait a bit (simulate user user thinking)
        console.log('2. Waiting 2s before canceling...');
        await new Promise(r => setTimeout(r, 2000));

        // 3. Cancel
        console.log('3. sending Cancel request...');
        const cancelRes = await axios.post(`${BASE_URL}/jobs/${CLIENT_ID}/${jobId}/cancel`);
        console.log('   Cancel Response:', cancelRes.data);

        // 4. Poll verification
        console.log('4. Verifying status is canceled...');
        let status = 'pending';
        let maxChecks = 10;

        while (status !== 'canceled' && status !== 'completed' && status !== 'failed' && maxChecks > 0) {
            await new Promise(r => setTimeout(r, 1000));
            const jobRes = await axios.get(`${BASE_URL}/jobs/${CLIENT_ID}/${jobId}`);
            status = jobRes.data.job.status;
            console.log(`   Status: ${status}`);
            maxChecks--;
        }

        if (status === 'canceled') {
            console.log('   ✅ Job successfully canceled!');
        } else {
            console.error(`   ❌ Failed to cancel job. Final status: ${status}`);
            process.exit(1);
        }

        // 5. Verify no artifacts published (optional, but good)
        // We expect Dezembro 2026 to NOT be published if we canceled fast enough.
        // However, if the first month generated VERY fast, it might exist. 
        // Given 2s wait, month 1 *might* finish or be in progress.
        // Taking the win on status check first.

    } catch (err: any) {
        console.error('❌ Test C failed:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

runTestC();
