import React from 'react';
export function Button({className='',primary=false,children,...props}) {
  return <button type="button" className={`sg-button ${primary?'sg-primary':''} ${className}`} {...props}>{children}</button>;
}
