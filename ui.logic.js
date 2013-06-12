angular.module('ui.bootstrap.position', [])

/**
 * A set of utility methods that can be use to retrieve position of DOM elements.
 * It is meant to be used where we need to absolute-position DOM elements in
 * relation to other, existing elements (this is the case for tooltips, popovers,
 * typeahead suggestions etc.).
 */
.factory('$position', ['$document', '$window', function($document, $window) {

	function getStyle(el, cssprop) {
		if (el.currentStyle) { //IE
			return el.currentStyle[cssprop];
		} else if ($window.getComputedStyle) {
			return $window.getComputedStyle(el)[cssprop];
		}
		// finally try and get inline style
		return el.style[cssprop];
	}

	/**
	 * Checks if a given element is statically positioned
	 * @param element - raw DOM element
	 */

	function isStaticPositioned(element) {
		return (getStyle(element, "position") || 'static') === 'static';
	}

	/**
	 * returns the closest, non-statically positioned parentOffset of a given element
	 * @param element
	 */
	var parentOffsetEl = function(element) {
		var docDomEl = $document[0];
		var offsetParent = element.offsetParent || docDomEl;
		while (offsetParent && offsetParent !== docDomEl && isStaticPositioned(offsetParent)) {
			offsetParent = offsetParent.offsetParent;
		}
		return offsetParent || docDomEl;
	};

	return {
		/**
		 * Provides read-only equivalent of jQuery's position function:
		 * http://api.jquery.com/position/
		 */
		position: function(element) {
			var elBCR = this.offset(element);
			var offsetParentBCR = {
				top: 0,
				left: 0
			};
			var offsetParentEl = parentOffsetEl(element[0]);
			if (offsetParentEl != $document[0]) {
				offsetParentBCR = this.offset(angular.element(offsetParentEl));
				offsetParentBCR.top += offsetParentEl.clientTop;
				offsetParentBCR.left += offsetParentEl.clientLeft;
			}

			return {
				width: element.prop('offsetWidth'),
				height: element.prop('offsetHeight'),
				top: elBCR.top - offsetParentBCR.top,
				left: elBCR.left - offsetParentBCR.left
			};
		},

		/**
		 * Provides read-only equivalent of jQuery's offset function:
		 * http://api.jquery.com/offset/
		 */
		offset: function(element) {
			var boundingClientRect = element[0].getBoundingClientRect();
			return {
				width: element.prop('offsetWidth'),
				height: element.prop('offsetHeight'),
				top: boundingClientRect.top + ($window.pageYOffset || $document[0].body.scrollTop),
				left: boundingClientRect.left + ($window.pageXOffset || $document[0].body.scrollLeft)
			};
		}
	};
}]);

var logicsuggest = angular.module('logicsuggest', ['ui.bootstrap.position']);

logicsuggest.filter('typeaheadHighlight', function() {

	function escapeRegexp(queryToEscape) {
		return queryToEscape.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
	}

	return function(matchItem, query) {
		return query ? matchItem.toString().replace(new RegExp(escapeRegexp(query), 'gi'), '<strong>$&</strong>') : matchItem;
	};
});

logicsuggest.directive('suggestions', function() {
	return {
		restrict: 'A',
		template: '<ul class="suggest dropdown-menu" ng-style="{display:open&&\'block\'||\'none\', top:(position.top+position.height)+\'px\',left:position.left+\'px\'}" >\
			<li ng-repeat="suggestion in suggestions[0]" ng-class="{active: isActive(0,$index)}">\
				<a tabindex="-1" ng-click="selectMatch(0,$index)" ng-bind-html-unsafe="suggestion|typeaheadHighlight:query"></a>\
			</li>\
			<li class="divider" ng-show="suggestions[0].length > 0 && suggestions[1].length > 0"></li>\
			<li ng-repeat="forward in suggestions[1]" ng-class="{active: isActive(1,$index)}">\
				<a tabindex="-1" ng-click="selectMatch(1,$index)" ng-bind-html-unsafe="forward|typeaheadHighlight:query">{{forward|typeaheadHighlight:query}}</a>\
			</li>\
		</ul>',
		scope: {
			suggestions: '=',
			select: '=',
			position: '=',
			activeId: '=',
			open: '=',
			query: '='
		},
		link: function(scope, element, attrs) {
			function indexxToArray(id, vals) {
				return [((id < vals[0].length) ? 0 : 1), ((id < vals[0].length) ? id : id - vals[0].length)];
			}
			scope.selectMatch = function(setIndex, index) {
				scope.select(setIndex, index);
			}
			scope.isActive = function(setIndex, index) {
				return (setIndex == scope.activeId[0] && index == scope.activeId[1]);
			}
		}
	}
});


logicsuggest.directive('logicExpression', ['$compile', '$position', function($compile, $position) {
	var expEvalRes = angular.element('<!-- <pre jsonshow="result"></pre><pre jsonshow="suggestedValues"></pre> -->');
	return {
		require: 'ngModel',
		restrict: 'E',
		replace: true,
		template: '<div class="row-fluid control-group input-append"></div>',
		scope: {
			suggestionsSet: '=',
			submit:'&',
			loading:'='
		},
		compile: function(tElem, attr) {
			function indexToArray(id, vals) {
				return [((id < vals[0].length) ? 0 : 1), ((id < vals[0].length) ? id : id - vals[0].length)];
			}
			var input = angular.element('<input type="text" class="span11" ng-model="' + attr.ngModel + '">'),
				button = angular.element('<button class="btn"  ng-click="submit(' + attr.ngModel + ');" ng-show="valid"><i ng-class="{\'icon-spin\':loading==true}" class="icon-search"/></button>'), //class="icon-search"
				suggestionsEl = angular.element('<div suggestions="suggestedValues" select="select" active-id="activeIdArr" query="query" open="open" position="position"></div>');

			tElem.append(input);
			tElem.append(button);
			return function(scope, element, attrs, ctrl) {		
				console.log(scope.$parent);	
				console.log(scope);
		
				var parser = new logicParser.Parser(),
					suggester = new LogicSuggester(scope.suggestionsSet);
				scope.$watch('suggestionsSet',function(value){
					suggester = new LogicSuggester(scope.suggestionsSet);
				})
				scope.activeId = 0;
				scope.activeIdArr = [0, 0];
				// scope.expression = undefined;
				scope.valid = false;
				scope.result = {};
				scope.suggestedValues = [
					[],
					[]
				];

				tElem.after($compile(suggestionsEl)(scope));
				// tElem.after($compile(expEvalRes)(scope));

				var HOT_KEYS = [9, 13, 27, 38, 40];
				var HOT_KEYS_CTRL = [32];
				input.bind('keydown', function(evt) {
					if (!(HOT_KEYS.indexOf(evt.which) > -1 || (HOT_KEYS_CTRL.indexOf(evt.which) > -1 && evt.ctrlKey))) {
						return;
					}
					evt.preventDefault();
					switch (evt.which) {
						case 9:
							//tab
							if (scope.open) {
								scope.select(scope.activeIdArr[0], scope.activeIdArr[1]);
								scope.$digest();
							}
							break;
						case 13:
							//enter
							if (scope.open) {
								scope.select(scope.activeIdArr[0], scope.activeIdArr[1]);
								scope.open = false;
								scope.resetActive();
								scope.$digest();
							}else{
								if(scope.valid == true){
									scope.submit();
									scope.$parent.$digest();
									// scope.$digest();
								}
							}
							break;
						case 27:
							//escape
							scope.open = false;
							scope.resetActive()
							scope.$digest();
							break;
						case 32:
							//space (ctrl+space)
							scope.open = true;
							scope.$digest();
							break;
						case 38:
							//up
							if (scope.open) {
								scope.activeId = (scope.activeId ? scope.activeId : scope.suggestedValues[0].length + scope.suggestedValues[1].length) - 1;
								scope.activeIdArr = indexToArray(scope.activeId, scope.suggestedValues);
								scope.$digest();
							}
							break;
						case 40:
							//down
							if (scope.open) {
								scope.activeId = (scope.activeId + 1) % ((scope.suggestedValues[0].length + scope.suggestedValues[1].length) > 0 ? (scope.suggestedValues[0].length + scope.suggestedValues[1].length) : 1);
								scope.activeIdArr = indexToArray(scope.activeId, scope.suggestedValues);
								scope.$digest();
							}
							break;
						default:
							break;
					}
				});
				scope.resetActive = function() {
					scope.activeId = 0;
					scope.activeIdArr = [0, 0];
					scope.query = '';
				}
				scope.select = function(setIndex, index) {
					var seletedValue = scope.suggestedValues[setIndex][index];
					seletedValue = seletedValue.toString().indexOf(' ') > -1 ? '"' + seletedValue + '"' : seletedValue;
					var wholeExpression = ctrl.$viewValue || '';
					var newVal = '';
					if (setIndex > 0 || wholeExpression=='') {
						newVal = wholeExpression + ' ' + seletedValue;
					} else {
						var toReplace = parser.tokenizer ? parser.tokenizer.last().value : '';
						var newVal = wholeExpression.replace(new RegExp(toReplace + '$'), seletedValue);
					}
					ctrl.$setViewValue(newVal);
				}

				scope.$watch(attr.ngModel, function(value) {
					scope.$parent[attr.ngModel] = value;
					
					scope.position = $position.position(input);
					if (value) {
						try {
							scope.result = parser.parse(value);
							scope.valid = true;
							scope.lasttoken = ' ';
							scope.query = parser.tokenizer.last().value;
							scope.suggestedValues = suggester.suggestBetter(parser.tokenizer.tokens);

						} catch (e) {
							scope.result = e.message;
							scope.valid = false;
							scope.query = e.lastToken.value;
							scope.suggestedValues = suggester.suggestBetter(parser.tokenizer.tokens);
						}
					} else {
						console.log(parser.tokenizer.tokens);
						// scope.valid = false;
						scope.valid = true;
						scope.resetActive();
						scope.result = {};
						scope.suggestedValues = suggester.suggestBetter([]);
						scope.suggestedValues[1] = [];
					}
				});
			}
		}
	}
}]);