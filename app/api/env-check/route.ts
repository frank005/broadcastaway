import { NextResponse } from 'next/server';

// Ensure we're using Node.js runtime
export const runtime = 'nodejs';

export async function GET() {
  // Check environment variables
  const envVars = {
    // Frontend variables
    NEXT_PUBLIC_AGORA_APP_ID: process.env.NEXT_PUBLIC_AGORA_APP_ID 
      ? `${process.env.NEXT_PUBLIC_AGORA_APP_ID.substring(0, 8)}... (length: ${process.env.NEXT_PUBLIC_AGORA_APP_ID.length})` 
      : 'MISSING',
    
    // Backend variables
    AGORA_APP_CERTIFICATE: process.env.AGORA_APP_CERTIFICATE 
      ? `${process.env.AGORA_APP_CERTIFICATE.substring(0, 8)}... (length: ${process.env.AGORA_APP_CERTIFICATE.length})` 
      : 'MISSING',
    
    AGORA_CUSTOMER_ID: process.env.AGORA_CUSTOMER_ID 
      ? `${process.env.AGORA_CUSTOMER_ID.substring(0, 8)}...` 
      : 'MISSING',
    
    AGORA_CUSTOMER_SECRET: process.env.AGORA_CUSTOMER_SECRET 
      ? 'SET (hidden)' 
      : 'MISSING',
    
    AGORA_REST_API_KEY: process.env.AGORA_REST_API_KEY 
      ? `${process.env.AGORA_REST_API_KEY.substring(0, 8)}...` 
      : 'MISSING',
    
    AGORA_REST_API_SECRET: process.env.AGORA_REST_API_SECRET 
      ? 'SET (hidden)' 
      : 'MISSING',
    
    AGORA_BASE_URL: process.env.AGORA_BASE_URL || 'NOT SET (using default)',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET (hidden)' : 'MISSING',
  };

  // Check if .env.local file exists
  const fs = require('fs');
  const envLocalPath = require('path').join(process.cwd(), '.env.local');
  const envPath = require('path').join(process.cwd(), '.env');
  
  const fileInfo = {
    '.env.local': fs.existsSync(envLocalPath) ? 'EXISTS' : 'NOT FOUND',
    '.env': fs.existsSync(envPath) ? 'EXISTS' : 'NOT FOUND',
    'process.cwd()': process.cwd(),
  };

  console.log('🔍 [ENV CHECK] Environment variables check:');
  console.log('🔍 [ENV CHECK] Files:', fileInfo);
  console.log('🔍 [ENV CHECK] Variables:', envVars);

  return NextResponse.json({
    success: true,
    files: fileInfo,
    environment: envVars,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(k => 
      k.includes('AGORA') || k.includes('OPENAI') || k.includes('NEXT_PUBLIC')
    ),
  });
}

