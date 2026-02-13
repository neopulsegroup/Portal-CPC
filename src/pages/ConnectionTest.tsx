import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function ConnectionTest() {
    const [status, setStatus] = useState<{
        auth: 'loading' | 'success' | 'error';
        db: 'loading' | 'success' | 'error';
        env: 'loading' | 'success' | 'error';
        details: string[];
    }>({
        auth: 'loading',
        db: 'loading',
        env: 'loading',
        details: []
    });

    useEffect(() => {
        checkConnection();
    }, []);

    async function checkConnection() {
        const logs: string[] = [];

        // 1. Check Env Vars
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (url && key) {
            logs.push(`✅ Environment Variables detected.`);
            logs.push(`URL: ${url}`);
            logs.push(`Key (masked): ${key.slice(0, 5)}...${key.slice(-5)}`);
            setStatus(prev => ({ ...prev, env: 'success', details: logs }));
        } else {
            logs.push(`❌ Missing Environment Variables.`);
            setStatus(prev => ({ ...prev, env: 'error', details: logs }));
            return;
        }

        // 2. Check Auth Service
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            logs.push(`✅ Auth Service is reachable.`);
            setStatus(prev => ({ ...prev, auth: 'success', details: logs }));
        } catch (err: any) {
            logs.push(`❌ Auth Service Error: ${err.message}`);
            setStatus(prev => ({ ...prev, auth: 'error', details: logs }));
        }

        // 3. Check Database (Public Table)
        try {
            // Try to select from a table that should exist, e.g., profiles
            // Using count to verify just access, not data
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            if (error) {
                // If table doesn't exist, code is often '42P01'
                if (error.code === '42P01') {
                    logs.push(`❌ Database Error: Table 'profiles' does not exist.`);
                    logs.push(`⚠️ It seems the migration script was not run.`);
                } else {
                    logs.push(`❌ Database Error: ${error.message} (Code: ${error.code})`);
                }
                setStatus(prev => ({ ...prev, db: 'error', details: logs }));
            } else {
                logs.push(`✅ Database Connection Successful.`);
                logs.push(`Found 'profiles' table with ${count} records.`);
                setStatus(prev => ({ ...prev, db: 'success', details: logs }));
            }
        } catch (err: any) {
            logs.push(`❌ Unexpected DB Error: ${err.message}`);
            setStatus(prev => ({ ...prev, db: 'error', details: logs }));
        }
    }

    return (
        <div className="container mx-auto p-8 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Supabase Connection Diagnostic</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">

                        <StatusItem label="Environment Variables" status={status.env} />
                        <StatusItem label="Auth Service" status={status.auth} />
                        <StatusItem label="Database (Profiles Table)" status={status.db} />

                    </div>

                    <div className="bg-muted p-4 rounded-md font-mono text-xs overflow-auto max-h-60 mt-4">
                        {status.details.map((log, i) => (
                            <div key={i} className="mb-1">{log}</div>
                        ))}
                    </div>

                    <Button onClick={checkConnection} className="w-full">
                        Retry Connection Test
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

function StatusItem({ label, status }: { label: string, status: 'loading' | 'success' | 'error' }) {
    return (
        <div className="flex items-center justify-between p-3 border rounded-lg">
            <span className="font-medium">{label}</span>
            {status === 'loading' && <Loader2 className="animate-spin text-blue-500" />}
            {status === 'success' && <CheckCircle className="text-green-500" />}
            {status === 'error' && <XCircle className="text-red-500" />}
        </div>
    );
}
