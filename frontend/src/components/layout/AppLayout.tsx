import { Outlet, NavLink } from 'react-router-dom';
import { Shield, ClipboardList, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { to: '/questionnaire', icon: Shield, label: 'Questionnaire' },
    { to: '/checklist', icon: ClipboardList, label: 'Checklist' },
    { to: '/exclusions', icon: EyeOff, label: 'Exclusions' },
];

export function AppLayout() {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center">
                    <div className="flex items-center gap-2 mr-8">
                        <Shield className="h-6 w-6 text-primary" />
                        <span className="text-lg font-bold">Modern RAT</span>
                    </div>

                    <nav className="flex items-center gap-6">
                        {navItems.map(({ to, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary',
                                        isActive ? 'text-primary' : 'text-muted-foreground'
                                    )
                                }
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-4">
                        <span className="text-xs text-muted-foreground">
                            Security Requirements Automation
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container py-8">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="border-t py-6">
                <div className="container flex items-center justify-between text-sm text-muted-foreground">
                    <p>Modern RAT - Security Requirements Automation Tool</p>
                    <p>
                        Standards: OWASP ASVS 5.0.0 | OWASP SPVS 1.0.0
                    </p>
                </div>
            </footer>
        </div>
    );
}
