import l from '..';

console.log(
  l
    .number()
    .min(1)
    .required()
    .label('Hey')
    .validate(null),
);
