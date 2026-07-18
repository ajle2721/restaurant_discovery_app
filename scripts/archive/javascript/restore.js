const fs = require('fs');

const logPath = 'C:\\Users\\aou\\.gemini\\antigravity\\brain\\973eca96-7195-45cc-99ac-babef94fe98d\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
let diffOutput = null;

for (const line of lines) {
    if (line.includes('@@ -630,984 +630,6 @@')) {
        try {
            const data = JSON.parse(line);
            function findDiff(d) {
                if (typeof d === 'object' && d !== null) {
                    if (d.output && typeof d.output === 'string' && d.output.includes('@@ -630,984 +630,6 @@')) {
                        return d.output;
                    }
                    for (const key in d) {
                        const res = findDiff(d[key]);
                        if (res) return res;
                    }
                } else if (Array.isArray(d)) {
                    for (const v of d) {
                        const res = findDiff(v);
                        if (res) return res;
                    }
                }
                return null;
            }
            diffOutput = findDiff(data);
            if (diffOutput) break;
        } catch (e) {
            // ignore JSON parse errors
        }
    }
}

if (diffOutput) {
    const diffLines = diffOutput.split('\n');
    let extracted = [];
    let inBlock = false;
    for (const line of diffLines) {
        if (line.startsWith('@@ -630,984 +630,6 @@')) {
            inBlock = true;
            continue;
        }
        if (inBlock) {
            if (line.startsWith('@@')) break;
            if (line.startsWith('-')) {
                extracted.push(line.substring(1));
            }
        }
    }
    fs.writeFileSync('recovered.js', extracted.join('\n'));
    console.log(`Recovered ${extracted.length} lines.`);
} else {
    console.log("Could not find the diff output.");
}
