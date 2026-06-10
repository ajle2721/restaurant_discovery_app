import fs from "node:fs";
import path from "node:path";

const baseDir = "c:\\Users\\aou\\Desktop\\Alice\\Study\\side project\\restaurant map";
const csvFiles = [
    "aggregated_restaurants.csv",
    "annotated_v2.csv",
    "annotated_v3_with_signals.csv",
    "annotated_v5_signals_final.csv",
    "feedback.csv"
];

for (const file of csvFiles) {
    const filePath = path.join(baseDir, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
        const firstLine = content.split(/\r?\n/)[0];
        console.log(`${file}: ${firstLine}`);
    } else {
        console.log(`${file}: Not found`);
    }
}
