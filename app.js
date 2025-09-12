const { useState } = React;

function App(){
  const [level, setLevel] = useState('A1');
  const [topic, setTopic] = useState('salutacions');
  const [mode, setMode] = useState('lesson');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(){
    setLoading(true);
    setOutput('');
    try{
      const resp = await fetch('/api/lesson',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level,topic,mode})});
      const data = await resp.json();
      if(data.ok) setOutput(data.text);
      else setOutput('Error: '+(data.error||'unknown'));
    }catch(e){ setOutput('Network error: '+e.message); }
    setLoading(false);
  }

  return React.createElement('div', {className:'space-y-6'},
    React.createElement('h1',{className:'text-2xl font-bold'}, 'IA Professor de Català'),
    React.createElement('div', {className:'flex gap-2'},
      React.createElement('select',{value:level,onChange:e=>setLevel(e.target.value),className:'p-2 border rounded'},
        ['A1','A2','B1','B2','C1','C2'].map(l=>React.createElement('option',{key:l,value:l},l))
      ),
      React.createElement('input',{value:topic,onChange:e=>setTopic(e.target.value),className:'p-2 border rounded flex-1',placeholder:'Tema (ex: verbs ser/estar)'}),
      React.createElement('select',{value:mode,onChange:e=>setMode(e.target.value),className:'p-2 border rounded'},
        ['lesson','practice','pronunciation'].map(m=>React.createElement('option',{key:m,value:m},m))
      ),
      React.createElement('button',{onClick:ask,disabled:loading,className:'px-4 py-2 bg-sky-600 text-white rounded disabled:opacity-50'}, loading? 'Carregant...': 'Genera')
    ),
    React.createElement('div',{className:'bg-white p-4 rounded shadow min-h-[160px] whitespace-pre-line'}, output || 'Aquí apareixerà la lliçó...')
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
