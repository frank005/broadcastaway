import { NextResponse } from 'next/server';

// Ensure we're using Node.js runtime
export const runtime = 'nodejs';

export async function GET() {
  // Calculate total size of all environment variables (for Netlify 4KB limit check)
  const allEnvVars: Array<{ key: string; valueSize: number; keySize: number; totalSize: number; valuePreview: string }> = [];
  let totalSize = 0;
  
  // Get all environment variables
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      const keySize = Buffer.byteLength(key, 'utf8');
      const valueSize = Buffer.byteLength(value, 'utf8');
      // Each env var has ~2 bytes overhead (equals sign, null terminator, etc.)
      const totalVarSize = keySize + valueSize + 2;
      totalSize += totalVarSize;
      
      allEnvVars.push({
        key,
        valueSize,
        keySize,
        totalSize: totalVarSize,
        valuePreview: value.length > 50 ? value.substring(0, 50) + '...' : value
      });
    }
  }
  
  // Sort by size (largest first)
  allEnvVars.sort((a, b) => b.totalSize - a.totalSize);
  
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

  const sizeInfo = {
    totalSizeBytes: totalSize,
    totalSizeKB: (totalSize / 1024).toFixed(2),
    limitBytes: 4096,
    limitKB: 4,
    overLimit: totalSize > 4096,
    overByBytes: totalSize > 4096 ? totalSize - 4096 : 0,
    overByKB: totalSize > 4096 ? ((totalSize - 4096) / 1024).toFixed(2) : '0',
    totalVariables: allEnvVars.length,
    largestVariables: allEnvVars.slice(0, 20), // Top 20 largest
    variablesByCategory: {
      recording: allEnvVars.filter(v => v.key.startsWith('RECORDING_')).reduce((sum, v) => sum + v.totalSize, 0),
      stt: allEnvVars.filter(v => v.key.startsWith('STT_')).reduce((sum, v) => sum + v.totalSize, 0),
      aiAgent: allEnvVars.filter(v => v.key.startsWith('AI_AGENT_')).reduce((sum, v) => sum + v.totalSize, 0),
      agora: allEnvVars.filter(v => v.key.includes('AGORA')).reduce((sum, v) => sum + v.totalSize, 0),
      openai: allEnvVars.filter(v => v.key.includes('OPENAI')).reduce((sum, v) => sum + v.totalSize, 0),
      microsoft: allEnvVars.filter(v => v.key.includes('MICROSOFT')).reduce((sum, v) => sum + v.totalSize, 0),
      reactApp: allEnvVars.filter(v => v.key.startsWith('REACT_APP_')).reduce((sum, v) => sum + v.totalSize, 0),
      nextPublic: allEnvVars.filter(v => v.key.startsWith('NEXT_PUBLIC_')).reduce((sum, v) => sum + v.totalSize, 0),
      other: allEnvVars.filter(v => 
        !v.key.startsWith('RECORDING_') && 
        !v.key.startsWith('STT_') && 
        !v.key.startsWith('AI_AGENT_') && 
        !v.key.includes('AGORA') && 
        !v.key.includes('OPENAI') && 
        !v.key.includes('MICROSOFT') && 
        !v.key.startsWith('REACT_APP_') && 
        !v.key.startsWith('NEXT_PUBLIC_')
      ).reduce((sum, v) => sum + v.totalSize, 0)
    }
  };

  console.log('🔍 [ENV CHECK] Environment variables check:');
  console.log('🔍 [ENV CHECK] Files:', fileInfo);
  console.log('🔍 [ENV CHECK] Total size:', sizeInfo.totalSizeKB, 'KB');
  console.log('🔍 [ENV CHECK] Over limit:', sizeInfo.overLimit);

  return NextResponse.json({
    success: true,
    files: fileInfo,
    environment: envVars,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(k => 
      k.includes('AGORA') || k.includes('OPENAI') || k.includes('NEXT_PUBLIC')
    ),
    sizeInfo: sizeInfo,
    allVariables: allEnvVars // Include all for detailed analysis
  });
}

