/* A stable search surface; the shell owns queries and progressive results.
 * GPL-3.0-or-later. */
import React from 'react';
import './search.css';

function SearchIcon(){
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
}

export function SearchHint({mobile,query='',recent=[]}){
  if(mobile||query)return <p className="sg-search-empty">{query?'Press Search to find this title.':'Search for a movie, series or anime.'}</p>;
  if(!recent.length)return <div className="sg-search-welcome"><h2>What would you like to watch?</h2><p>Find a movie, series or anime by title.</p></div>;
  return <section className="sg-search-recent" aria-labelledby="sg-search-recent-title"><h2 id="sg-search-recent-title">Recent searches</h2>
    <div className="sg-search-recent-list">{recent.map(value=><button type="button" key={value.toLowerCase()} data-action="search-recent" data-query={value} title={value}><SearchIcon/><span>{value}</span></button>)}</div>
    <button type="button" className="sg-search-history-clear" data-action="search-history-clear">Clear history</button>
  </section>;
}

export default function Search({mobile,query=''}){
  return <section className="sg-page search-content sg-search-page">
    <header className="sg-search-header">
      <h1>Search</h1>
      <a className="sg-search-home" href="#/board"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg><span>Home</span></a>
    </header>
    <form id="sg-search-form" className="sg-search-form" role="search">
      {!mobile?<span className="sg-search-glyph"><SearchIcon/></span>:null}
      <input id="sg-search-input" type="search" autoComplete="off" spellCheck={false} enterKeyHint="search" placeholder="Movies, series and more" aria-label="Search titles" aria-describedby="sg-search-status" defaultValue={query}/>
      {!mobile?<button type="button" className="sg-search-clear" data-action="search-clear" aria-label="Clear search" hidden={!query}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg><span>Clear</span></button>:null}
      <button className="sg-button sg-primary sg-search-submit" type="submit">Search</button>
    </form>
    <p id="sg-search-status" className="sg-search-status" role="status" aria-live="polite"/>
    <div id="sg-search-results" aria-busy="false"/>
  </section>;
}
