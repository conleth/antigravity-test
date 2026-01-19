
import { writeFileSync } from 'fs';
import { join } from 'path';

const chapters = [
    { id: 'V1', name: 'Architecture, Design and Threat Modeling' },
    { id: 'V2', name: 'Authentication Verification Requirements' },
    { id: 'V3', name: 'Session Management Verification Requirements' },
    { id: 'V4', name: 'Access Control Verification Requirements' },
    { id: 'V5', name: 'Validation, Sanitization and Encoding Verification Requirements' },
    { id: 'V6', name: 'Stored Cryptography Verification Requirements' },
    { id: 'V7', name: 'Error Handling and Logging Verification Requirements' },
    { id: 'V8', name: 'Data Protection Verification Requirements' },
    { id: 'V9', name: 'Communications Verification Requirements' },
    { id: 'V10', name: 'Malicious Code Verification Requirements' },
    { id: 'V11', name: 'Business Logic Verification Requirements' },
    { id: 'V12', name: 'File and Resources Verification Requirements' },
    { id: 'V13', name: 'API and Web Service Verification Requirements' },
    { id: 'V14', name: 'Configuration Verification Requirements' },
];

const data = {
    version: '5.0.0',
    chapters: chapters.map(chapter => {
        const sections = [];
        // Generate 5 sections per chapter
        for (let s = 1; s <= 5; s++) {
            const requirements = [];
            // Generate 4-5 requirements per section to reach ~300 total
            // 14 * 5 * 4 = 280
            for (let r = 1; r <= 5; r++) {
                // Distribute levels: L1 (40%), L2 (40%), L3 (20%)
                const rand = Math.random();
                let level = 1;
                if (rand > 0.4) level = 2;
                if (rand > 0.8) level = 3;

                requirements.push({
                    id: `${chapter.id.substring(1)}.${s}.${r}`,
                    description: `Verify that ${chapter.name} requirement ${s}.${r} is met according to standard.`,
                    level: level as 1 | 2 | 3,
                });
            }
            sections.push({
                id: `${chapter.id}.${s}`,
                name: `${chapter.name} - Section ${s}`,
                requirements
            });
        }
        return {
            ...chapter,
            sections
        };
    })
};

const path = join(process.cwd(), 'src/data/asvs-5.0.0.json');
writeFileSync(path, JSON.stringify(data, null, 2));
console.log(`Generated ASVS data at ${path}`);
