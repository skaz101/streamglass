/* A stable search surface; the shell owns queries and progressive results.
 * GPL-3.0-or-later. */
import React from 'react';
import './search.css';

function SearchIcon(){
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
}

export function SearchHint({mobile,query='',recent=[]}){
  if(mobile||query)return <p className="sg-search-empty">{query?(mobile?'Press Search to find this title.':'Keep typing, or choose Results to search.'):'Search for a movie, series or anime.'}</p>;
  if(!recent.length)return <div className="sg-search-welcome"><h2>What would you like to watch?</h2><p>Find a movie, series or anime by title.</p></div>;
  return <section className="sg-search-recent" aria-labelledby="sg-search-recent-title"><h2 id="sg-search-recent-title">Recent searches</h2>
    <div className="sg-search-recent-list">{recent.map(value=><button type="button" key={value.toLowerCase()} data-action="search-recent" data-query={value} title={value}><SearchIcon/><span>{value}</span></button>)}</div>
    <button type="button" className="sg-search-history-clear" data-action="search-history-clear">Clear history</button>
  </section>;
}

const SEARCH_KEYS='abcdefghijklmnopqrstuvwxyz1234567890'.split('');
function SearchKeyboard({query}){
  // A focused input always opens LG's system keyboard. The TV query is a plain
  // noneditable display; the hidden value keeps the shell's search contract.
  return <form id="sg-search-form" className="sg-search-form sg-search-keyboard" role="search">
    <input id="sg-search-input" type="hidden" defaultValue={query}/>
    <div id="sg-search-query" className="sg-search-query" role="textbox" aria-label="Search titles" aria-readonly="true" aria-describedby="sg-search-status" tabIndex={0} data-action="search-keyboard">
      <span className="sg-search-glyph"><SearchIcon/></span>
      <span className="sg-search-query-text"><span data-query-before>{query}</span><span className="sg-search-caret" data-query-caret="start" aria-hidden="true" hidden/><span data-query-selection/><span className="sg-search-caret" data-query-caret="end" aria-hidden="true"/><span data-query-after/><span className="sg-search-placeholder" hidden={!!query}>Movies, series and more</span></span>
    </div>
    <div className="sg-search-keys" role="group" aria-label="Letters and numbers">
      {SEARCH_KEYS.map(key=><button type="button" key={key} data-action="search-key" data-key={key} aria-label={key}>{key}</button>)}
    </div>
    <div className="sg-search-tools" role="group" aria-label="Edit search">
      <button type="button" data-action="search-key" data-key="space">Space</button>
      <button type="button" data-action="search-key" data-key="backspace" aria-label="Delete previous character"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h12v14H9L2 12Z"/><path d="m12 9 6 6m0-6-6 6"/></svg><span>Delete</span></button>
      <button type="button" data-action="search-key" data-key="clear">Clear</button>
    </div>
    <button className="sg-button sg-primary sg-search-submit" type="submit">Results <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button>
  </form>;
}

export default function Search({mobile,query=''}){
  return <section className={'sg-page search-content sg-search-page'+(mobile?'':' sg-search-tv')}>
    <header className="sg-search-header">
      <h1>Search</h1>
      <a className="sg-search-home" href="#/board"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg><span>Home</span></a>
    </header>
    {mobile?<><form id="sg-search-form" className="sg-search-form" role="search">
      <input id="sg-search-input" type="search" autoComplete="off" spellCheck={false} enterKeyHint="search" placeholder="Movies, series and more" aria-label="Search titles" aria-describedby="sg-search-status" defaultValue={query}/>
      <button className="sg-button sg-primary sg-search-submit" type="submit">Search</button>
    </form>
    <p id="sg-search-status" className="sg-search-status" role="status" aria-live="polite"/>
    <div id="sg-search-results" aria-busy="false"/></>:<div className="sg-search-layout">
      <SearchKeyboard query={query}/>
      <div className="sg-search-results-pane"><p id="sg-search-status" className="sg-search-status" role="status" aria-live="polite"/><div id="sg-search-results" aria-busy="false"/></div>
    </div>}
  </section>;
}
