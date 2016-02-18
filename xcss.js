(function xcss() {

    "use strict";
    var allCSSRules = {};
    var visitedRules = {};
    var EXTENDS_EXPR = /\s+extends\s+/i;
    var styleSheet = addNewStylesheet();

    document.addEventListener('DOMContentLoaded', inheritCSSRules);
    return;

    function inheritCSSRules() {
        //collect all style rules
        console.time('inheritCSSRules');
        collectRules(document);
        //console.log(allCSSRules);
        extendRules(allCSSRules);

        //console.log(styleSheet);
        console.timeEnd('inheritCSSRules');
    }


    function extendRules(cssRules) {
        Object.keys(cssRules).forEach(
            function (selector) {

                if (visitedRules[selector]) {
                    //console.log('skipping visited selector: ' + selector);
                    return;
                }
                visitedRules[selector] = cssRules[selector];

                var inherit = selector.trim().split(EXTENDS_EXPR);
                if (inherit.length === 2) {
                    console.log('processing selector: ' + selector);
                    var dest = inherit[0].trim();
                    var from = inherit[1].trim().split(/\s*,\s*/).map(
                        function (fromSelector) {
                            //resolve fromSelector when not found in currenttly resolved rules
                            if (!cssRules[fromSelector]) {
                                console.log('resolving rule fromSelector: ' + fromSelector);
                                extendRules(cssRules);
                            }
                            return (cssRules[fromSelector]) ? cssRules[fromSelector].style.cssText : '';
                        }
                    ).join(' ');
                    var self = cssRules[selector];
                    console.log('adding rule: ' + dest + '{' + self.style.cssText + from + '}');
                    var idx = styleSheet.insertRule(dest + '{' + self.style.cssText + from + '}', styleSheet.cssRules.length);
                    cssRules[dest] = styleSheet.cssRules[idx];
                }
            }
        );
    }

    function collectRules(container) {
        [].slice.call(container.styleSheets || []).forEach(
            function (styleSheet) {
                [].slice.call(styleSheet.cssRules || []).forEach(
                    function (cssRule) {
                        allCSSRules[cssRule.selectorText] = cssRule;
                    }
                );
                collectRules(styleSheet);
            }
        );
    }

    function addNewStylesheet() {
        var styleEl = document.createElement('style'),
            styleSheet;

        // Append style element to head
        document.head.appendChild(styleEl);

        // Grab style sheet
        return styleEl.sheet;
    }


})();
