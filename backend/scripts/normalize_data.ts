
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

// Paths
const ROOT_DIR = join(process.cwd(), '..'); // Assuming running from backend/
const ASVS_SRC = join(ROOT_DIR, 'OWASP_Application_Security_Verification_Standard_5.0.0_en.json');
const SPVS_SRC = join(ROOT_DIR, 'OWASP_SPVS_1.0_-en_Requirements.csv');
const DATA_DIR = join(process.cwd(), 'src', 'data');

const ASVS_DEST = join(DATA_DIR, 'asvs-5.0.0.json');
const SPVS_DEST = join(DATA_DIR, 'spvs-1.0.0.csv');

// --- ASVS Transformation ---
try {
    console.log(`Reading ASVS from ${ASVS_SRC}...`);
    const rawAsvs = readFileSync(ASVS_SRC, 'utf-8');
    const sourceAsvs = JSON.parse(rawAsvs);

    const transformChapter = (item: any) => ({
        id: item.Shortcode,
        name: item.Name,
        sections: item.Items ? item.Items.map(transformSection) : []
    });

    const transformSection = (item: any) => ({
        id: item.Shortcode,
        name: item.Name,
        requirements: item.Items ? item.Items.map(transformRequirement) : []
    });

    const transformRequirement = (item: any) => ({
        id: item.Shortcode,
        description: item.Description,
        level: parseInt(item.L || (item.Items ? "0" : "1"), 10) // Handle leaf items
    });

    // The root source has "Requirements" which are Chapters
    const targetAsvs = {
        version: sourceAsvs.Version,
        chapters: sourceAsvs.Requirements.map(transformChapter)
    };

    writeFileSync(ASVS_DEST, JSON.stringify(targetAsvs, null, 2));
    console.log(`Successfully wrote ASVS data to ${ASVS_DEST}`);

} catch (err: any) {
    if (err.code === 'ENOENT') {
        console.warn('ASVS source file not found, skipping.');
    } else {
        console.error('Error processing ASVS:', err);
    }
}

// --- SPVS Transformation ---
try {
    console.log(`Reading SPVS from ${SPVS_SRC}...`);
    const rawSpvs = readFileSync(SPVS_SRC, 'utf-8');
    const records = parse(rawSpvs, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true // Handle BOM if present
    });

    // Map to: req_id,category,subcategory,req_name,level,NIST,OWASP_CICD,CWE
    const mappedRecords = records.map((r: any) => {
        // Calculate level
        let level = 1;
        if (r['level 1'] && r['level 1'].trim().toUpperCase() === 'X') level = 1;
        else if (r['level 2'] && r['level 2'].trim().toUpperCase() === 'X') level = 2;
        else if (r['level 3'] && r['level 3'].trim().toUpperCase() === 'X') level = 3;

        // Clean Description
        // The file has 'req_description'
        // Handle potential 'catagory_name' typo
        const category = r['catagory_name'] || r['category_name'] || '';
        const subcategory = r['sub-catagory_name'] || r['sub-category_name'] || '';

        return {
            req_id: r.req_id,
            category: category,
            subcategory: subcategory,
            req_name: r.req_description, // Mapping description to req_name as per our schema
            level: level,
            NIST: r.NIST || '',
            OWASP_CICD: r.OWASP_CICD_Risk || '',
            CWE: r.cwe_mapping || ''
        };
    }).filter((r: any) => r.req_id && r.req_id.startsWith('V'));

    // Convert to CSV
    // Simple CSV stringify
    const header = 'req_id,category,subcategory,req_name,level,NIST,OWASP_CICD,CWE\n';
    const csvContent = header + mappedRecords.map((r: any) => {
        const escape = (str: string | number) => {
            const s = String(str);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };
        return [
            r.req_id,
            r.category,
            r.subcategory,
            r.req_name,
            r.level,
            r.NIST,
            r.OWASP_CICD,
            r.CWE
        ].map(escape).join(',');
    }).join('\n');

    writeFileSync(SPVS_DEST, csvContent);
    console.log(`Successfully wrote SPVS data to ${SPVS_DEST} (${mappedRecords.length} records)`);

} catch (err: any) {
    if (err.code === 'ENOENT') {
        console.warn('SPVS source file not found, skipping.');
    } else {
        console.error('Error processing SPVS:', err);
    }
}
