(function(exports) {

	function Expecting(type, lastToken) {
		this.type = type;
		this.lastToken = lastToken;

		this.lastTokenValue = lastToken ? lastToken.value || '' : '';
		this.lastTokenType = lastToken ? lastToken.type || '' : '';
		this.name = 'Expecting';
		this.message = 'Expecting ' + type + ', last Token: ' + this.lastTokenValue + ' (' + this.lastTokenType + ')';
	}
	Expecting.prototype = new Error();
	Expecting.prototype.constructor = Error;

	function Token(type, value) {
		this.type = type;
		this.value = value.trim();
		this.isKey = function() {
			return this.type == 'key';
		}
		this.isValue = function() {
			return this.type == 'value';
		}
		this.isComparator = function() {
			return this.type == 'comparator';
		}
		this.isOperator = function() {
			return this.type == 'operator';
		}
		this.isNot = function() {
			return (this.type == 'operator' && this.value == '!');
		}
		this.isAnd = function() {
			return (this.type == 'operator' && (this.value == 'and' || this.value == '&&'))
		}
		this.isOr = function() {
			return (this.type == 'operator' && (this.value == 'or' || this.value == '||'))
		}
		this.isEnd = function() {
			return this.type == 'END'
		}
	}

	function Tokenizer(expression) {
		// distinction between key and value are nor helpfull... both are "strings"
		var tokenDef = {
			// 'key': /^ *([a-zA-Z0-9-]{1,}) *(=|>=|<=|>|<|!=)/, 
			// 'key': /^ *([a-zA-Z0-9-]{1,}) */, 
			'comparator': /^ *(=|>=|<=|>|<|!=|like) */, // in['a','b'] -> $in:['a','b'];  >= ; <= 
			'operator': /^(and) ?|^(or) ?|^(&&) ?|^(\|\|) ?|^(\() ?|^(\)) ?|^(!) ?/, //|^(!) ?
			'string': /^ *(([a-zA-Z0-9-_\.\*%:\\\/\.]{1,})|([\'\"][a-zA-Z0-9-_\.\*%:\(\)\\\/\. ]{1,}[\'\"])) */
		};
		this.tokens = [];

		this.originalExpression = expression;
		this.peek = function() {
			var token = null;
			expression = expression.trim();
			for (tokenType in tokenDef) {
				var type = tokenType;
				var re = tokenDef[tokenType];
				var match = expression.match(re);
				if (match) {
					if (tokenType == 'string') {
						if (this.tokens.length > 0 && this.tokens[this.tokens.length - 1].type == 'comparator') {
							type = 'value';
						} else {
							type = 'key';
						}
					}
					token = new Token(type, ((match[1] || match[0]).trim()));
					break;
				}
			}
			if (!token) {
				return new Token('END', '')
			} else {
				return token;
			}
		}

		this.next = function() {
			var token = this.peek();
			this.tokens.push(token);
			expression = expression.replace(token.value, '');
			return token;
		}

		this.tokenize = function() {
			while (expression.length > 0) {
				this.next();
			}
		}

		this.last = function() {
			return this.tokens[this.tokens.length - 1].type == 'END' ? this.tokens[this.tokens.length - 2] : this.tokens[this.tokens.length - 1];
		}
	}

	function Parser(expression) {
		this.expression = expression;
		var that = this;
		that.tokenizer = (expression) ? new Tokenizer(expression) : new Tokenizer('');

		// if (expression) that.tokenizer = new Tokenizer(expression);
		// Condition ::= Key '=' Value | 
		// 		  		 Key '>' Value |
		//		 		 Key '<' Value |
		//				 Key

		function parseCondition() {
			var keyToken = that.tokenizer.next();
			if (!keyToken.isKey() && !keyToken.isValue()) throw new Expecting('KEY', that.tokenizer.last());
			var compToken = that.tokenizer.peek();
			if (compToken && compToken.isComparator()){
				compToken = that.tokenizer.next();
			}else{
				return {
					comparator: 'exists',
					key: keyToken.value,
				}				
			}
			if (!compToken || !compToken.isComparator()) throw new Expecting('COMPARATOR', that.tokenizer.last());
			var valueToken = that.tokenizer.next();
			if (!valueToken.isValue()) throw new Expecting('VALUE', that.tokenizer.last());

			return {
				comparator: compToken.value,
				key: keyToken.value,
				value: valueToken.value,
			}

		}

		// Primary ::= Condition |
		//			   '('OrExpression')'

		function parsePrimary() {
			var exp;
			var token = that.tokenizer.peek();
			if (token.isKey() || token.isValue()) {
				var condition = parseCondition();
				return {
					comparison: condition
				}
			}
			if (token.isOperator() && token.value == '(') {
				that.tokenizer.next();
				var exp = parseExpression();
				token = that.tokenizer.next();
				if (token.isOperator() && token.value == ')') {
					return {
						expression: exp
					}
				} else {
					throw new Expecting(')');
				}
			}
		}

		// Unary ::= Primary |
		//		 	 '!'Unary

		function parseUnary() {
			var exp;
			var token = that.tokenizer.peek();
			if (token.isNot()) {
				token = that.tokenizer.next();
				exp = parseUnary();

				return {
					unary: {
						operator: token.value,
						expression: exp
					}
				}
			}
			return parsePrimary();
		}

		// AndExpression ::= Unary | 
		//					 AndExpression 'and' unary|

		function parseAndExp() {
			var token, left, right;
			left = parseUnary();
			token = that.tokenizer.peek();
			if (token.isAnd()) {
				token = that.tokenizer.next();
				right = parseAndExp();
				if (!right) throw new Expecting('EXPRESSION', token);

				return {
					binary: {
						operator: token.value,
						left: left,
						right: right
					}
				}
			} else if (!token.isEnd() && !token.isOperator()) {
				throw new Expecting('OPERATOR', token);
			}
			return left;
		}

		// OrExpression ::= AndExpression |
		// 				    OrExpression 'or' AndExpression

		function parseOrExp() {
			var token, left, right;
			left = parseAndExp();
			token = that.tokenizer.peek();
			if (token.isOr()) {
				token = that.tokenizer.next();
				right = parseExpression();

				return {
					binary: {
						operator: token.value,
						left: left,
						right: right
					}
				}
			}

			return left;
		}

		// Expression ::= OrExpression

		function parseExpression() {
			var exp = parseOrExp();
			if (!exp) throw new Expecting('EXPRESSION', that.tokenizer.last());
			return exp
		}

		this.parse = function(expression) {
			if (expression) {
				that.tokenizer = new Tokenizer(expression);
			} else if (!(this.expression)) {
				throw new Error('No expression to parse...');
			}
			var exp = parseExpression();
			return {
				expression: exp
			}
		}
	}

	// context Needed? 


	// BUG => AlertName != "SYSTEM DOWN - SERVER" and AlertName!= "SNMP NOT RESPONDING - SERVER" =>DOUBLE KEY

	function EvalToMongo(expression) {
		this.expression = expression;
		evalToMongo = this;

		function isArray(o) {
			// just not to depend on underscore.js
			return Object.prototype.toString.call(o) === "[object Array]";
		}

		function evaluate(node,not) {
			var not = not || false;
			if (node.hasOwnProperty('expression')) {
				var exp = evaluate(node.expression,not);
				return exp
			}
			
			if (node.hasOwnProperty('binary') && !not) {
				node = node.binary;
				var left = evaluate(node.left,not);
				var right = evaluate(node.right,not);
				if (node.operator == 'or') {
					return [].concat(left, right);
				}
				if (node.operator == 'and') {
					var and = extend(left, right);
					return and;
				}
			}
			if (node.hasOwnProperty('unary')) {
				node = node.unary;
				if (node.operator == '!') {
					return evaluate(node,true)
				
				}
			}
			if (node.hasOwnProperty('comparison')) {
				return genComparison(node.comparison,not);
			}
		}


		function extend(o1, o2) {
			var ret = {};
			if (isArray(o1) || isArray(o2)) {
				ret['$and'] = [];
				if (isArray(o1)) {
					ret['$and'].push({
						'$or': o1
					});
				} else {
					ret['$and'].push(o1);
				}
				if (isArray(o2)) {
					ret['$and'].push({
						'$or': o2
					});
				} else {
					ret['$and'].push(o2);
				}
				return ret;
			}
			for (k in o1) {
				ret[k] = o1[k];
			}
			for (k in o2) {
				if (k in ret) {
					ret['$and'] = [];
					var a = {};
					a[k] = o2[k];
					ret['$and'].push(a);
					var a = {};
					a[k] = ret[k];
					ret['$and'].push(a);
					delete ret[k];
				} else {
					ret[k] = o2[k];
				}
			}
			return ret;
		}

		// might be better to do Type detection when tokenizing..

		function handleValue(value) {
			if (value.match(/^[-]{0,1}\d*$/)) {
				return parseInt(value);
			} else {
				var cleanValue = value.replace(/"/g, '');
				if(cleanValue.match(/^[-]{0,1}\d*$/)){
					return cleanValue;
				}
				//try to make a date out of the clean value
				var d = new Date(cleanValue);
				if (Object.prototype.toString.call(d) === "[object Date]") {
					// it is a date
					if (isNaN(d.getTime())) { // d.valueOf() could also work
						// date is not valid
						return cleanValue;
					} else {
						// date is valid
						return d;
					}
				} else {
					// not a date
					return cleanValue;
				}
			}
		}

		function genComparison(node,not) {
			/* {
              "comparator": "=",
              "key": "C",
              "value": "D"
            }*/
			var comparator = node.comparator,
				key = node.key,
				ret = {};
			if(node.value)
				var value = handleValue(node.value);

			switch (comparator) {
				case '=':
					ret[key] = value;
					break;
				case '>':
					ret[key] = {
						$gt: value
					};
					break;
				case '>=':
					ret[key] = {
						$gte: value
					};
					break;
				case '<':
					ret[key] = {
						$lt: value
					};
					break;
				case '<=':
					ret[key] = {
						$lte: value
					};
					break;
				case '!=':
					ret[key] = {
						$ne: value
					};
					break;
				case 'like':
					//not like???
					if(!not){
						ret[key] = {
							$regex: '^' + value + '$', //$regex: value, 
							$options: 'i'
						};
					}else{
						var r = new RegExp('^'+value+'$');
						ret[key] = {$not:r}
					}
					break
				case 'exists':
					ret[key] = {
						$exists:(true && !not)
					}
					break;
				default:
					break;
			}
			return ret;
		}

		this.run = function(exp) {
			if (typeof exp === 'string') {
				var parser = new Parser(exp);
				exp = parser.parse();
			}

			this.query = [];
			prev = {};
			var query = evaluate(exp);

			if (isArray(query)) {
				return {
					$or: query
				}
			}
			return query;
		}
	}

	exports.Token = Token;
	exports.Tokenizer = Tokenizer;
	exports.Parser = Parser;
	exports.EvalToMongo = EvalToMongo;

})(typeof exports === 'undefined' ? this['logicParser'] = {} : exports)