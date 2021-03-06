import {EntityMetadata} from "./EntityMetadata";
import {IndexMetadataArgs} from "../metadata-args/IndexMetadataArgs";
import {NamingStrategyInterface} from "../naming-strategy/NamingStrategyInterface";
import {ColumnMetadata} from "./ColumnMetadata";

/**
 * Index metadata contains all information about table's index.
 */
export class IndexMetadata {

    // ---------------------------------------------------------------------
    // Public Properties
    // ---------------------------------------------------------------------

    /**
     * Entity metadata of the class to which this index is applied.
     */
    entityMetadata: EntityMetadata;

    /**
     * Indicates if this index must be unique.
     */
    isUnique: boolean = false;

    /**
     * Target class to which metadata is applied.
     */
    target?: Function|string;

    /**
     * Indexed columns.
     */
    columns: ColumnMetadata[] = [];

    /**
     * User specified index name.
     */
    givenName?: string;

    /**
     * User specified column names.
     */
    givenColumnNames?: ((object?: any) => (any[]|{ [key: string]: number }))|string[];

    /**
     * Final index name.
     * If index name was given by a user then it stores normalized (by naming strategy) givenName.
     * If index name was not given then its generated.
     */
    name: string;

    /**
     * Gets the table name on which index is applied.
     */
    tableName: string;

    /**
     * Map of column names with order set.
     * Used only by MongoDB driver.
     */
    columnNamesWithOrderingMap: { [key: string]: number } = {};

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(options: {
        entityMetadata: EntityMetadata,
        columns?: ColumnMetadata[],
        args?: IndexMetadataArgs
    }) {
        this.entityMetadata = options.entityMetadata;
        if (options.columns)
            this.columns = options.columns;

        if (options.args) {
            this.target = options.args.target;
            this.isUnique = options.args.unique;
            this.givenName = options.args.name;
            this.givenColumnNames = options.args.columns;
        }
    }

    // ---------------------------------------------------------------------
    // Public Build Methods
    // ---------------------------------------------------------------------

    /**
     * Builds some depend index properties.
     * Must be called after all entity metadata's properties map, columns and relations are built.
     */
    build(namingStrategy: NamingStrategyInterface): this {

        const map: { [key: string]: number } = {};
        this.tableName = this.entityMetadata.tableName;

        // if columns already an array of string then simply return it
        if (this.givenColumnNames) {
            let columnPropertyNames: string[] = [];
            if (this.givenColumnNames instanceof Array) {
                columnPropertyNames = this.givenColumnNames;
                columnPropertyNames.forEach(name => map[name] = 1);
            } else {
                // if columns is a function that returns array of field names then execute it and get columns names from it
                const columnsFnResult = this.givenColumnNames(this.entityMetadata.propertiesMap);
                if (columnsFnResult instanceof Array) {
                    columnPropertyNames = columnsFnResult.map((i: any) => String(i));
                    columnPropertyNames.forEach(name => map[name] = 1);
                } else {
                    columnPropertyNames = Object.keys(columnsFnResult).map((i: any) => String(i));
                    Object.keys(columnsFnResult).forEach(columnName => map[columnName] = columnsFnResult[columnName]);
                }
            }

            this.columns = columnPropertyNames.map(propertyName => {
                const columnWithSameName = this.entityMetadata.columns.find(column => column.propertyPath === propertyName);
                if (columnWithSameName) {
                    return [columnWithSameName];
                }
                const relationWithSameName = this.entityMetadata.relations.find(relation => relation.isWithJoinColumn && relation.propertyName === propertyName);
                if (relationWithSameName) {
                    return relationWithSameName.joinColumns;
                }
                throw new Error(`Index ${this.givenName ? "\"" + this.givenName + "\" " : ""}contains column that is missing in the entity: ` + propertyName);
            })
            .reduce((a, b) => a.concat(b));
        }

        this.columnNamesWithOrderingMap = Object.keys(map).reduce((updatedMap, key) => {
            const column = this.entityMetadata.columns.find(column => column.propertyPath === key);
            if (column)
                updatedMap[column.databaseName] = map[key];
            return updatedMap;
        }, {} as { [key: string]: number });
        this.name = namingStrategy.indexName(this.givenName ? this.givenName : undefined, this.entityMetadata.tableName, this.columns.map(column => column.databaseName));
        return this;
    }

}