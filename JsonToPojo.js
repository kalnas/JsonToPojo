
function jsonToPojoConverter() {
	var instance = {};
	
	function mergeArrayObjects(objArray) {
		var result = {};
	
		for (var i = 0; i < objArray.length; i++) {
			for (var field in objArray[i]) {
				if (!result.hasOwnProperty(field)) {
					result[field] = objArray[i][field];
				}
			}
		}
	
		return result;
	}

	function capitalize(str) {
		return str[0].toUpperCase() + str.slice(1);
	}

	function getJavaType(type) {
		switch(type) {
			case 'array': 
				return 'List';
			case 'object': 			
			case 'string': 
			case 'date': // should be String?
			case 'integer':
			case 'double':
			case 'boolean':
				return capitalize(type);
			default: 
				return type;
		}
	}

	function getType(val) {
		var typeInfo = {
			'type': typeof val
		};
	
		switch(typeInfo.type) {
			case 'object':
				// if the object is an array, get type of array content
				// otherwise, get the definition of the object value itself
				if (Array.isArray(val)) {			
					typeInfo.type = 'array';
				
					if (typeof val[0] === 'object') {
						typeInfo.definition = getType(mergeArrayObjects(val));						
					} else {
						typeInfo.definition = getType(val[0]);
					}
				} else {
					typeInfo.definition = getObjectDefinition(val);
				}
		
				break;		
			case 'string':
				if (/(\d{2}|\d{4})[\-\\\/]\d{1,2}[\-\\\/]\d{1,2}/.test(val)) {
					typeInfo.type = 'date';
				}
		
				break;		
			case 'number':
				if (Number.isInteger(val)) {
					typeInfo.type = 'integer';
				} else {
					typeInfo.type = 'double';
				}
		
				break;
		}

		return typeInfo;
	}

	function getObjectDefinition(obj) {
		var objectDefinition = {};
	
		// create a definition object that contains a map
		// of field names to field types, recursing on object
		// field types
		for (field in obj) {
			objectDefinition[field] = getType(obj[field]);
		}
	
		return objectDefinition;
	}

	function getJavaClassDefinition(className, fields) {
		var result = '';
	
		result += '@JsonInclude(JsonInclude.Include.NON_EMPTY)\n';
		result += '@JsonIgnoreProperties(ignoreUnknown = true)\n';		
		result += 'public class ' + className + ' {\n\n';		
	
		// output list of private fields
		for (var i = 0; i < fields.length; i++) {
			result += '    final private ' + fields[i].typeDeclaration + ' ' + fields[i].fieldName + ';\n';
		}
	
		// output constructor parameters
		result += '\n    @JsonCreator\n';
		result += '    public ' + className + '(\n';
		for (var i = 0; i < fields.length; i++) {
			result += '         @JsonProperty("' + fields[i].fieldName + '") ' + fields[i].typeDeclaration + ' ' + fields[i].fieldName + (i === fields.length - 1 ? ') ' : ',\n');
		}	
	
		// output constructor content
		result += '{\n\n';		
		for (var i = 0; i < fields.length; i++) {
			result += '        this.' + fields[i].fieldName + ' = ' + fields[i].fieldName + ';\n';
		}					
		result += '    }\n\n\n';
	
		// output public getters
		for (var i = 0; i < fields.length; i++) {
			var javaGetterName = ( fields[i].typeDeclaration === 'Boolean' ? 'is' :'get' ) + capitalize(fields[i].fieldName);
			result += '    ' + 'public ' + fields[i].typeDeclaration + ' ' + javaGetterName + '() {\n        return ' + fields[i].fieldName + ';\n    }\n' + (i === fields.length - 1 ? '' : '\n');
		}
	
		result += '}\n\n\n';
	
		return result;
	}

	instance.convert = function(json) {
		try {
			var objectDefinition = getObjectDefinition( JSON.parse(json) );	
		} catch(ex) {
			return ex;
		}
	
		var classQueue = [ 
			{
				'name': 'RootClass',
				'definition': objectDefinition
			} 
		];

		var result = '';			
	
		while(classQueue.length > 0) {
			var fields = [];
			var cls = classQueue.shift();		

			for (var field in cls.definition) {
				var type = cls.definition[field].type;
				var arrayType = '';
				var objType = undefined;
			
				if (type === 'array') {
					if (cls.definition[field].definition.type === 'object') {
						classQueue.push({
							'name': capitalize(field) + 'ItemType',
							'definition': cls.definition[field].definition.definition
						});
						arrayType = '<' + capitalize(field) + 'ItemType>'
					} else {
						arrayType = '<' + capitalize(cls.definition[field].definition.type) + '>';
					}
				}
			
				if (type === 'object') {
					objType = capitalize(field) + 'Type';
					classQueue.push({
						'name': objType,
						'definition': cls.definition[field].definition
					});
				}
			
				var typeDeclaration = objType ? objType : getJavaType(type) + arrayType;						

				fields.push({
					'fieldName': field,
					'typeDeclaration': typeDeclaration
				});			
			}

			result += getJavaClassDefinition(cls.name, fields);		

		}

		return result;
	}
	
	return instance;
}

