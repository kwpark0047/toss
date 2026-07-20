class ApiClient {
    constructor({ baseUrl, apiKey, storeId }) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
        this.storeId = storeId;
    }

    async fetchPendingJobs() {
        const url = `${this.baseUrl}/api/print-jobs/pending?store_id=${this.storeId}`;
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
        const json = await res.json();
        return json.data || json.jobs || [];
    }

    async claimJob(jobId) {
        const url = `${this.baseUrl}/api/print-jobs/${jobId}/claim`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error(`Claim failed: ${res.status}`);
        return true;
    }

    async completeJob(jobId) {
        const url = `${this.baseUrl}/api/print-jobs/${jobId}/complete`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error(`Complete failed: ${res.status}`);
        return true;
    }

    async failJob(jobId, error) {
        const url = `${this.baseUrl}/api/print-jobs/${jobId}/fail`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error })
        });
        if (!res.ok) throw new Error(`Fail report failed: ${res.status}`);
        return true;
    }
}

module.exports = ApiClient;
