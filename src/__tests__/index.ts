import l from '..';

console.log(
  l
    .boolean()
    .required()
    .label('Hey')
    .validate(null),
);
