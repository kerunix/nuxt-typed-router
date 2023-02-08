import { DestructuredPath } from '../../../../../core/parser/params';
import { RoutePathsDecl } from '../../../../../types';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

export function createRoutePathSchema(routePaths: RoutePathsDecl[]) {
  return `export type RoutePathSchema = 
    ${routePaths
      .filter((f) => !!f.path)
      .map((route) => `"${route.path}"`)
      .join('|')}
  `;
}

export function createValidatePathTypes(pathElements: DestructuredPath[][][]): string {
  let pathConditions = pathElements.map(createTypeValidatePathCondition);

  const conditionsList = pathConditions.map((m) => m.condition);

  return `
    ${pathConditions.length ? conditionsList.join('\n\n') : ''}

    export type ValidatePath<T extends string> = T extends string 
      ? T extends '/' 
        ? T 
        : ${
          pathConditions.length
            ? pathConditions.map((t) => `${t.typeName}<T> extends true ? T`).join(': ')
            : 'never'
        } 
      : \`Error: \${${pathConditions
        .map((t) => `${t.typeName}<T>`)
        .join('|')}}\` : 'Type should be a string';
  
  
    export type RouteNameFromPath<T extends string> = T extends string 
      ? T extends '/' 
        ? "index"
        : ${
          pathConditions.length
            ? pathConditions
                .map((t) => `${t.typeName}<T> extends true ? "${t.routeName}"`)
                .join(': ')
            : 'never'
        } 
      : never : never;
  
        `;
}

export function createTypedRouteFromPathType(pathElements: DestructuredPath[][][]): string {
  let pathConditions = pathElements.map(createTypeValidatePathCondition);

  const conditionsList = pathConditions.map((m) => m.condition);

  return `
    export type ValidatePath<T extends string> = T extends string 
      ? T extends '/' 
        ? 'index' 
        : ${
          pathConditions.length
            ? pathConditions.map((t) => `${t.typeName}<T> extends true ? T`).join(': ')
            : 'never'
        } 
      : \`Error: \${${pathConditions
        .map((t) => `${t.typeName}<T>`)
        .join('|')}}\` : 'Type should be a string';
  `;
}

export function createTypeValidatePathCondition(elements: DestructuredPath[][]) {
  const typeName = `Validate${nanoid(7)}`;
  const params = new Map();
  const routeName = elements.flat()[0].routeName;
  const hasOnlyNames = elements.flat().every((elem) => elem.type === 'name');

  const condition = `type ${typeName}<T> = T extends \`/${elements
    .map((elementArray, index) => {
      return elementArray
        .map((elem) => {
          const isLast = index === elements.flat().length - 1;

          if (elem.type === 'name' && isLast && !hasOnlyNames) {
            const id = nanoid(6);
            params.set(elem.id, id);
            return `${elem.content}\${infer ${id}}`;
          } else if (elem.type === 'name') {
            return elem.content;
          } else if (elem.type === 'param' || elem.type === 'optionalParam') {
            const id = nanoid(6);
            params.set(elem.id, id);
            return `\${infer ${id}}`;
          } else if (elem.type === 'catchAll') {
            return `\${string}`;
          }
        })
        .join('');
    })
    .join('/')}\`
    ? ${
      hasOnlyNames
        ? `true :`
        : elements
            .flat()
            .map((elem, index) => {
              let output = '';
              const isLast = index === elements.flat().length - 1;
              const isName = elem.type === 'name';
              const isOptional = elem.type === 'optionalParam';
              const isParam = elem.type === 'param';
              const isCatchAll = elem.type === 'catchAll';

              if (isName && isLast) {
                output = `ValidEndOfPath<${params.get(elem.id)}> extends false ? "End of path '${
                  elem.fullPath
                }' is invalid" : true :`;
              } else if (isParam && isLast) {
                output = `ValidParam<${params.get(elem.id)}> extends false ? "Parameter {${
                  elem.content
                }} of path '${elem.fullPath}' is invalid" : true :`;
              } else if (isParam) {
                output = `${params.get(elem.id)} extends '' ? "Parameter {${
                  elem.content
                }} of path '${elem.fullPath}' is required" : `;
              } else if (isOptional && isLast) {
                output = `ValidParam<${params.get(elem.id)}> extends false ? "Parameter {${
                  elem.content
                }} of path '${elem.fullPath}' is invalid" : true :`;
              } else if (isLast) {
                output += 'true :';
              }
              return output;
            })
            .join('')
    } "Incorrect route path" ;`;

  return {
    typeName,
    condition,
    routeName,
  };
}