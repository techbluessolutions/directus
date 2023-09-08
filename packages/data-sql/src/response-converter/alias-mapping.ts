/**
 * Here a map is created which maps the generated aliases used to query the database,
 * to a path which defines how nested the resulting object should be, which the driver returns.
 *
 * Also the user specified alias is taken to account here, by replacing the generated alias with the user specified one.
 *
 * @see https://app.excalidraw.com/s/DWVAUCmAav/XNAsaVlIY5
 * @module
 */
import type {
	AbstractQueryFieldNode,
	AbstractQueryFieldNodeFn,
	AbstractQueryFieldNodePrimitive,
	AbstractQueryFieldNodeRelatedManyToOne,
} from '@directus/data';
import type { AbstractSqlQueryFnNode, AbstractSqlQueryJoinNode, AbstractSqlQuerySelectNode } from '../index.js';

export const mapAliasesToNestedPaths = (
	collection: string,
	fields: AbstractQueryFieldNode[],
	selects: (AbstractSqlQuerySelectNode | AbstractSqlQueryFnNode)[],
	joins: AbstractSqlQueryJoinNode[],
	path: string[] = []
): Map<string, string[]> => {
	const paths: Map<string, string[]> = new Map();

	for (const abstractField of fields) {
		if (abstractField.type === 'primitive' || abstractField.type === 'fn') {
			const generatedAlias = findGeneratedSelectAlias(abstractField, collection, selects);
			const fieldNameToBeReturned = abstractField.alias ?? abstractField.field;
			paths.set(generatedAlias, [...path, fieldNameToBeReturned]);
			continue;
		}

		if (abstractField.type === 'm2o') {
			const generatedJoinAlias = findGeneratedJoinAlias(abstractField, joins);

			const nested = mapAliasesToNestedPaths(generatedJoinAlias, abstractField.nodes, selects, joins, [
				...path,
				abstractField.join.external.collection,
			]);

			nested.forEach((value, key) => paths.set(key, value));

			continue;
		}
	}

	return paths;
};

/**
 * Finds the corresponding sql node from all selects to get the generated alias.
 *
 * @param fieldNode - a field or a function node
 * @param collection - the current collection of the traversal
 * @param abstractSqlSelects - the list of all select nodes. Each of which has a generated alias.
 */
function findGeneratedSelectAlias(
	fieldNode: AbstractQueryFieldNodePrimitive | AbstractQueryFieldNodeFn,
	collection: string,
	abstractSqlSelects: (AbstractSqlQuerySelectNode | AbstractSqlQueryFnNode)[]
): string {
	const accordingPrimitiveInAbstractSQL = abstractSqlSelects.find((select) => {
		return fieldNode.field === select.column && select.table === collection;
	}) as AbstractSqlQuerySelectNode;

	if (accordingPrimitiveInAbstractSQL === undefined) {
		throw new Error(`No primitive select node found for field ${fieldNode.field}`);
	}

	if (!accordingPrimitiveInAbstractSQL?.as) {
		throw new Error(`Primitive node does not have an unique id as alias.`);
	}

	return accordingPrimitiveInAbstractSQL.as;
}

/**
 * Finds the corresponding sql node from the join nodes to get the generated alias.
 *
 * @param relationalField - the m2o field node
 * @param joins - all joins of the query
 * @returns the alias of the joined table
 */
function findGeneratedJoinAlias(
	relationalField: AbstractQueryFieldNodeRelatedManyToOne,
	joins: AbstractSqlQueryJoinNode[]
): string {
	const joinNode = joins.find((join) => {
		return relationalField.join.external.collection === join.table;
	});

	if (joinNode === undefined) {
		throw new Error(`No sql join node found for to join table ${relationalField.join.external.collection}`);
	}

	return joinNode.as;
}
