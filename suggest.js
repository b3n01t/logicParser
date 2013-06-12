// when expect COMPARATOR => suggest KEYS + COMPARATOR
// when expect VALUE  => VALUE
// when have an expression back => need to do some mor error checking. 

// var logicParser = require('./logicParser.js');

// suggestions = {

// 	// keys:['AlertName','NodeName','monitorName'],
// 	// values:['TradeCapture Q POAS_MLPEQPMQ.RA10TC','SYSTEM DOWN - SERVER','SNMP NOT RESPONDING - SERVER'],
// 	values: {
// 		AlertName: ['TradeCapture Q POAS_MLPEQPMQ.RA10TC', 'SYSTEM DOWN - SERVER', 'SNMP NOT RESPONDING - SERVER'],
// 		NodeName: ['bosdbatch5'],
// 		monitorName: ['monitorUnix', 'monitorWin'],
// 	},
// 	comparators: ['=', 'like', '<', '<=', '>', '>=', '!='],
// 	operators: ['and', 'or']
// }
	
function LogicSuggester(suggestions) {
	function escapeRegexp(queryToEscape) {
		return queryToEscape.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
	}
	var that = this;

	this.suggestions = suggestions || {};

	this.types = Object.keys(this.suggestions);
	this.keyValue = this.suggestions.values || {};
	this.keys = Object.keys(this.keyValue);
	this.values = (function() {
		var vals = [];
		// for (k in that.keyValue) {
		// 	console.log(k);
		// 	vals = vals.concat(that.keyValue[k]);
		// }
		return vals;
	})();

	this.comparators = this.suggestions.comparators || [];
	this.operators = this.suggestions.operators || [];

	this.types.push('keys');

	function matchIn(value, potentials) {
		if (value === ''){
			return potentials;
		}

		var sug = []
		var r = new RegExp('.*' +escapeRegexp(value) + '.*', 'i');
		for (var i = 0; i < potentials.length; i++) {
			if (potentials[i]!=value && r.exec(potentials[i])) {
				sug.push(potentials[i]);
			}
		}
		return sug;
	}

	this.suggest = function(token, knowing, expecting) { // if token is an Array
		if (!(token instanceof logicParser.Token)) throw new Error('arg1 is not a Token');
		if (knowing && !(knowing instanceof logicParser.Token)) throw new Error('arg2 is not a Token');
		
		var type = token.type+'s',
			value = token.value,
			res = [],
			key = (knowing) ? knowing.value : '';
		
		if (type === 'values') {
			res = this.suggestValue(value, key);
		} else {
			type = (type === 'keys' && expecting === 'OPERATOR')?'operators':type;
			res = matchIn(value, this[type]);
		}

		var forward = [];
		switch (type) {
			case 'operators':
				forward = this.keys;
				break;
			case 'comparators':
				forward = this.suggest(new logicParser.Token('value',''),knowing)[0];
				break;
			case 'keys':
				forward = this.comparators;
				break;
			case 'values':
				forward = this.operators;
				break;
			default:
				break;
		}
		if (forward.length > 0) {
			return [res, forward];
		}
		return res
	}

	this.suggestBetter = function(tokens,expecting){
		console.log(tokens);
		var allTokens =  tokens.length > 0 ? tokens.slice():[new logicParser.Token('key','')];
		var lastToken = allTokens.pop();
		lastToken = lastToken.type === 'END' ? allTokens.pop() : lastToken;
		console.log(lastToken);
		if(lastToken.type === 'comparator'){
			lastKey = allTokens[allTokens.length -1];
			return this.suggest(lastToken,lastKey,expecting);

		}else if(lastToken.type === 'value'){
			lastKey = allTokens[allTokens.length - 2];
			return this.suggest(lastToken,lastKey,expecting);
		}else{
			return this.suggest(lastToken,null,expecting);
		}
	}

	this.suggestValue = function(value, key) {
		var potentials  = (key!=='')? this.keyValue[key] || this.values :this.values;	
		return matchIn(value, potentials);
	}
}

// var suggester = new LogicSuggester(suggestions);
// var parser = new logicParser.Parser();

// var strs = [
// 	'a'
// 	,'AlertName'
// 	,'AlertName ='
// 	,'AlertName = s'
// 	,'AlertName = "SYSTEM DOWN - SERVER"'
// 	,'AlertName = "SYSTEM DOWN - SERVER" a'
// 	,'AlertName = "SYSTEM DOWN - SERVER" and'
// 	,'AlertName = "SYSTEM DOWN - SERVER" and n'
// 	,'AlertName = "SYSTEM DOWN - SERVER" and NodeName'
// 	,'AlertName = "SYSTEM DOWN - SERVER" and NodeName='
// 	,'AlertName = "SYSTEM DOWN - SERVER" and NodeName=b'
// 	,'AlertName = "SYSTEM DOWN - SERVER" and NodeName=bosdbatch5'
// ];

// for (var i = 0; i < strs.length; i++) {
// 	var str = strs[i];
// 	try{
// 		parser.parse(str)
// 	}catch(e){
// 		console.log('------ ',str,' ------');
// 		console.log('Typing:', e.lastToken.type);
// 		console.log('Expecting:', e.type);
// 		console.log('--');
// 		console.log('suggestions: ',suggester.suggest(e.lastToken,null,e.type));
// 		console.log('------------------');
// 		console.log();
// 	}
// };


