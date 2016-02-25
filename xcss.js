(function xcss() {

    "use strict";
    var allCSSRules = {};
    var visitedRules = {};
    var KEYWORDS = /\s+(EXTENDS|SEND|WHEN|SET|DO)\s+/i;
    var styleSheet = addNewStylesheet();

    document.addEventListener('DOMContentLoaded', inheritCSSRules);
    window.addEventListener('hashchange',stateChanged);
    return;

    function stateChanged(){
        var state = {};
        var key = location.hash.split('?')[0].replace(/#\/?/,'').split('/').join('.');
        console.log('state:'+ key);
        state[key] ={search:location.search};
        postMessage(state,location.href);
    }

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
                var parts = selector.split(KEYWORDS);
                console.log('parts: [' + parts.join(' : '), '] selector:',selector);
                if (parts.length > 2) {
                    if (parts[1] === 'extends' ){
                        console.log('processing EXTENDS selector: ' + selector);
                        var dest = parts[0].trim();
                        var from = parts[2].trim().split(/\s*,\s*/).map(
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

                    if (parts[1] === 'when'){
                        console.log('processing WHEN selector: ' + selector);
                        var target = parts[0].trim();
                        var msg = parts[2].trim().split(/\s*,\s*/).forEach(
                          function(msgKey){
                              console.log('binding message listener: ' + msgKey);
                              window.addEventListener('message',
                                 function(evt){
                                    console.log('event received: '+  msgKey,'evt:' ,evt.data);
                                    //console.log('event received: ', evt.data );
                                    var elms = document.querySelectorAll(target);
                                    for ( var i=0; i < elms.length; i++ ){
                                      console.log('event handled:',msgKey);
                                      if ( !elms[i].cssText ) {
                                          elms[i].cssText = elms[i].style.cssText;
                                      }
                                      if ( evt.data[msgKey] ){

                                        elms[i].style.cssText = cssRules[selector].style.cssText;
                                      } else {
                                        elms[i].style.cssText = elms[i].cssText;
                                      }
                                    }
                                 }
                              );
                          }
                        );
                    }

                    if (parts[1] === 'send'){
                        console.log('processing SEND selector: ' + selector);
                        var target = parts[0].trim();
                        var msg = parts[2].trim();
                        console.log('binding message events: ' + msg + target);
                        var elms = document.querySelectorAll(target);
                        for ( var i=0; i < elms.length; i++ ){
                            console.log('adding eventlistener!')
                            elms[i].addEventListener('click',
                              function(evt){
                                  location.hash =msg + '?id=' + evt.srcElement.id;
                              }
                            );
                        }

                    }
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
