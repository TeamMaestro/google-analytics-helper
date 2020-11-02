export declare var ga: UniversalAnalytics.ga;

export async function initializeGoogleAnalytics(
    analyticsId: string,
    options?: {
        clientId?: string;
    }
) {
    const script = document.createElement('script');
    script.innerHTML = `
        (function (i, s, o, g, r, a, m) {
        i['GoogleAnalyticsObject'] = r; i[r] = i[r] || function () {
            (i[r].q = i[r].q || []).push(arguments)
        }, i[r].l = 1 * new Date(); a = s.createElement(o),
            m = s.getElementsByTagName(o)[0]; a.async = 1; a.src = g; m.parentNode.insertBefore(a, m)
        })(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');
    `;
    document.body.appendChild(script);

    const GA_LOCAL_STORAGE_KEY = 'ga:clientId';
    if (options && options.clientId) {
        ga('create', analyticsId, {
            storage: 'none',
            clientId: options.clientId
        });
    } else if (window.localStorage) {
        ga('create', analyticsId, {
            storage: 'none',
            clientId: localStorage.getItem(GA_LOCAL_STORAGE_KEY)
        });
        ga((tracker: any) => {
            localStorage.setItem(GA_LOCAL_STORAGE_KEY, tracker.get('clientId'));
        });
    } else {
        ga('create', analyticsId, 'auto');
    }
    ga('set', 'sendHitTask', offlineTracker);
    ga('set', 'checkProtocolTask', null);

    // If there are stored hits, send them on load
    if (getHits().length > 0) {
        try {
            await checkEndpoint();
            sendBatchHits();
        } catch {}
    }

    // Attempt to send hits whenever the app comes back online
    window.addEventListener('online', async () => {
        if (getHits().length > 0) {
            try {
                await checkEndpoint();
                sendBatchHits();
            } catch {}
        }
    });
}

interface Hit {
    payload: any;
    timestamp: number;
}

const StorageKey = 'ga_hits';

function storeHit(hit: Hit) {
    let rawStorage = localStorage.getItem(StorageKey);
    const storedHits = rawStorage ? JSON.parse(rawStorage) : [];
    storedHits.push(hit);
    localStorage.setItem(StorageKey, JSON.stringify(storedHits));
}

function storeHits(hits: Hit[]) {
    let rawStorage = localStorage.getItem(StorageKey);
    const storedHits = rawStorage ? JSON.parse(rawStorage) : [];
    storedHits.push(...hits);
    localStorage.setItem(StorageKey, JSON.stringify(storedHits));
}

function getHits(): Hit[] {
    let rawStorage = localStorage.getItem(StorageKey);
    return rawStorage ? JSON.parse(rawStorage) : [];
}

async function checkEndpoint() {
    const response = await fetch('https://www.google-analytics.com/collect', {
        method: 'HEAD'
    });
    if (response.status !== 200) {
        throw Error;
    }
}

async function offlineTracker(model: any) {
    // Get the hit payload
    const payload = model.get('hitPayload');

    try {
        // Check the Google Analytics collect endpoint to see if the user is online or if the endpoint is available
        await checkEndpoint();
        // Send current hit as an image request
        const img = document.createElement('img');
        img.width = 1;
        img.height = 1;
        img.src = `https://www.google-analytics.com/collect?${payload}`;

        // Send stored batch hits
        sendBatchHits();
    } catch {
        // The endpoint request failed, store this hit for later
        storeHit({
            payload,
            timestamp: Date.now()
        });
    }
}

async function sendBatchHits() {
    const hits = getHits();
    // Process hits in queue
    if (hits.length > 0) {
        const currentTimestamp = Date.now();
        // Batch endpoint only allows 20 hits per batch, chunk the hits array.
        const chunkSize = 20;
        const chunkedHits = Array.from({ length: Math.ceil(hits.length / chunkSize) }, (v, i) =>
            hits.slice(i * chunkSize, i * chunkSize + chunkSize)
        );

        const failedHits: Hit[] = [];
        // Loop through the chunks array and send the hits to GA
        chunkedHits.forEach(async (chunk) => {
            try {
                const response = await fetch('https://www.google-analytics.com/batch', {
                    method: 'POST',
                    body: chunk
                        .map((hit) => {
                            if (hit.timestamp) {
                                // Calculate how many miliseconds from now that the hit occured
                                let qt = Math.round((currentTimestamp - hit.timestamp) / 1000) * 1000;
                                // If the hit timestamp was more than 4 hours ago, just set it to 4 hours so it doesn't get dropped
                                // (https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#qt)
                                if (qt > 14400000) {
                                    qt = 14400000;
                                }
                                hit.payload = `${hit.payload}&qt=${qt}`;
                            }
                            return hit.payload;
                        })
                        .join('\n')
                });
                if (response.status !== 200) {
                    throw Error;
                }
            } catch (e) {
                failedHits.push(...chunk);
            }

            // Remove hits from localStorage
            localStorage.removeItem(StorageKey);

            // If there are any failed hits, store them to try again later
            if (failedHits.length > 0) {
                storeHits(failedHits);
            }
        });
    }
}
