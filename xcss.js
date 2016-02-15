/**
 * Created by eddy spreeuwers on 15-02-16.
 */

window.setTimeout(inheritCSSRules, 100);

function inheritCSSRules() {

    var allCSSRules = {};

    //collect all style rules


    collectRules(document);
    console.log(allCSSRules);
    var styleSheet = addNewStylesheet();

    Object.keys(allCSSRules).forEach(
        function(selector){
            var inherit = selector.trim().split(/\s+extends\s+/i);
            if (inherit.length === 2){
                var dest = inherit[0].trim();

                var from = inherit[1].trim().split(/\s*,\s*/).map(
                    function(sel){
                        return (allCSSRules[sel]) ? allCSSRules[sel].style.cssText : '';
                    }).join(' ');
                var self = allCSSRules[selector];
                styleSheet.insertRule(dest + '{' + self.style.cssText + from + '}', styleSheet.cssRules.length);
            }
        }
    );

    function collectRules(container) {
        [].slice.call(container.styleSheets||[]).forEach(
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

    function addNewStylesheet () {
        var styleEl = document.createElement('style'),
            styleSheet;

        // Append style element to head
        document.head.appendChild(styleEl);

        // Grab style sheet
        return styleEl.sheet;
    }
}
