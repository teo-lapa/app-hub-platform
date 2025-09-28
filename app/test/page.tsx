'use client';

export default function TestPage() {
  return (
    <div style={{ padding: '50px' }}>
      <h1>TEST PAGINA</h1>
      <input
        type="text"
        placeholder="SCRIVI QUI"
        style={{
          border: '2px solid black',
          padding: '10px',
          fontSize: '20px'
        }}
      />
      <button
        onClick={() => alert('FUNZIONA!')}
        style={{
          marginLeft: '10px',
          padding: '10px 20px',
          fontSize: '20px',
          background: 'green',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        CLICCA
      </button>
    </div>
  );
}