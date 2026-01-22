import { ShortlistedRequirement } from './types.js';

export type Role = 'developer' | 'architect' | 'devops' | 'security' | 'qa';

/**
 * Automatically assigns roles to a requirement based on keywords and category.
 */
export function getRolesForRequirement(req: Partial<ShortlistedRequirement>): Role[] {
    const roles = new Set<Role>();
    const text = ((req.description || '') + ' ' + (req.category || '') + ' ' + (req.title || '')).toLowerCase();

    // SPVS is heavy on DevOps/Infrastructure
    if (req.standard === 'SPVS') {
        roles.add('devops');
        if (text.includes('iam') || text.includes('access') || text.includes('identity')) {
            roles.add('architect');
        }
        if (text.includes('monitor') || text.includes('log') || text.includes('audit')) {
            roles.add('security');
        }
    }

    // Keyword based mapping
    if (
        text.includes('code') ||
        text.includes('implement') ||
        text.includes('validate') ||
        text.includes('sanitize') ||
        text.includes('encode') ||
        text.includes('input') ||
        text.includes('output') ||
        text.includes('logic') ||
        text.includes('application')
    ) {
        roles.add('developer');
    }

    if (
        text.includes('architect') ||
        text.includes('design') ||
        text.includes('structure') ||
        text.includes('protocol') ||
        text.includes('trust') ||
        text.includes('threat model') ||
        text.includes('authentication') ||
        text.includes('authorization') ||
        text.includes('session')
    ) {
        roles.add('architect');
    }

    if (
        text.includes('ci/cd') ||
        text.includes('pipeline') ||
        text.includes('deployment') ||
        text.includes('infrastructure') ||
        text.includes('cloud') ||
        text.includes('docker') ||
        text.includes('kubernetes') ||
        text.includes('server') ||
        text.includes('tls') ||
        text.includes('ssl') ||
        text.includes('certificates') ||
        text.includes('environment') ||
        text.includes('secret manager') ||
        text.includes('vault') ||
        text.includes('iac')
    ) {
        roles.add('devops');
    }

    if (
        text.includes('security') ||
        text.includes('penetration') ||
        text.includes('vulnerability') ||
        text.includes('pentest') ||
        text.includes('audit') ||
        text.includes('compliance') ||
        text.includes('policy') ||
        text.includes('cryptography') ||
        text.includes('encryption') ||
        text.includes('hash')
    ) {
        roles.add('security');
    }

    if (
        text.includes('verify') ||
        text.includes('test') ||
        text.includes('acceptance') ||
        text.includes('requirement') ||
        text.includes('user story') ||
        text.includes('functional')
    ) {
        roles.add('qa');
    }

    // Default fallbacks if no strong matches
    if (roles.size === 0) {
        if (req.standard === 'ASVS') roles.add('developer');
        else roles.add('devops');
    }

    return Array.from(roles);
}
