const { useState } = React;

function App(){
  const [text, setText] = useState("Benvingut/da! Aquesta és una prova de la teva IA per ensenyar català.");

  return React.createElement('div', {className: 'space-y-4'},
    React.createElement('h1', {className:'text-2xl font-bold'}, 'IA Professor de Català'),
    React.createElement('p', {className:'bg-white p-4 rounded shadow'}, text)
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
