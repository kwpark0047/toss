const test = require('node:test');
const assert = require('node:assert/strict');
const { collectDefinedIdentifiers, findJsxTags } = require('../../scripts/validate-jsx-references');

test('JSX validation recognizes destructured callback icon aliases and props', () => {
  const code = 'items.map(({ icon: RowIcon, label }) => <RowIcon />); const View = ({ Header }) => <Header />;';
  const defined = collectDefinedIdentifiers(code);
  for (const tag of findJsxTags(code)) assert.ok(defined.has(tag.name), tag.name);
});

test('JSX validation still detects undeclared object values', () => {
  const code = 'const options = { icon: MissingIcon }; const View = () => <MissingIcon />;';
  const defined = collectDefinedIdentifiers(code);
  assert.equal(defined.has('MissingIcon'), false);
  assert.ok(findJsxTags(code).some(tag => tag.name === 'MissingIcon'));
});

test('JSX validation checks icon metadata values and component props', () => {
  const code = "const methods = [{ icon: Banknote }]; const View = () => <Section icon={Building2} />;";
  const names = findJsxTags(code).map(tag => tag.name);
  assert.ok(names.includes('Banknote'));
  assert.ok(names.includes('Building2'));
});
