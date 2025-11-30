const NEXT_PUBLIC_BASE_URL = 'https://app-hub-platform.vercel.app';
const expectedUri = NEXT_PUBLIC_BASE_URL + '/api/email-ai/auth/gmail/callback';
const currentUri = NEXT_PUBLIC_BASE_URL + '/api/auth/google/callback';

console.log('=== GOOGLE OAUTH REDIRECT URI CONFIGURATION ===\n');
console.log('GOOGLE_REDIRECT_URI attuale (default):', currentUri);
console.log('Email AI Monitor richiede invece:', expectedUri);
console.log('\nMismatch:', currentUri !== expectedUri);
console.log('\n=== SOLUZIONE ===');
console.log('Aggiungi in .env.local:');
console.log('GOOGLE_REDIRECT_URI=' + expectedUri);
console.log('\nE configura in Google Cloud Console > Credentials > OAuth 2.0:');
console.log('- Authorized redirect URIs: ' + expectedUri);
console.log('\nPer staging:');
console.log('GOOGLE_REDIRECT_URI=https://staging.hub.lapa.ch/api/email-ai/auth/gmail/callback');
