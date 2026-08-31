from pathlib import Path

p = Path('apps/meta/meta-explorer-v2.js')
s = p.read_text()
old = """    const variantRow=target.closest('.variant-row');
    if(variantRow)return{name:variantRow.querySelector('span')?.textContent?.trim()||'',kind:'variant'};
    const node=target.closest('.rec-main h3,.deck-check-name b,.watch-card b,.why-matchup-name b');
"""
new = """    const variantRow=target.closest('.variant-row');
    if(variantRow)return{name:variantRow.querySelector('span')?.textContent?.trim()||'',kind:'variant'};
    const current=target.closest('.current-meta-row');
    if(current){
      const grouping=$('currentGroupingToggle')?.checked!==false;
      const expandable=current.classList.contains('expandable');
      if(!grouping || !expandable){
        return{name:current.querySelector('.current-name b')?.textContent?.trim()||'',kind:'variant'};
      }
      return null;
    }
    const node=target.closest('.rec-main h3,.deck-check-name b,.watch-card b,.why-matchup-name b');
"""
if old not in s:
    raise SystemExit('targetInfo anchor not found')
p.write_text(s.replace(old, new))

p = Path('apps/meta/index.html')
s = p.read_text().replace('meta-explorer-v2.js?v=3', 'meta-explorer-v2.js?v=4')
p.write_text(s)
