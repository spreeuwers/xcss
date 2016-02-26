(function xcss() {

    "use strict";
    var allCSSRules = {};
    var visitedRules = {};
    var WHEN = 'when';
    var EVENTS = 'click,dblclick,blur,change,mouseover,mouseout'.split(',');
    var KEYWORDS = /\s+(EXTENDS|CLICK|DBLCLICK|BLUR|CHANGE|WHEN)\s+/i;
    var styleSheet = addNewStylesheet();

    document.addEventListener('DOMContentLoaded', processCSSRules);
    window.addEventListener('hashchange',stateChanged);
    return;

    function stateChanged(){
        var state = {};
        var parts = location.hash.split('?');
        var keys = parts[0].replace(/#\/?/,'').split('/');
        var parms =(parts[1]||'').split('&');
        console.log('state:' + keys);

        var result = keys.reduce(
           function(prev, key){
               prev[key] = {};
               return prev[key];

           },state
        );

        parms.forEach(function(parm){
            var keyVal = parm.split('=');
            var  key = keyVal[0];
            var  val = keyVal[1];
            if (key){
              result[key] = val;
            }
        });

        console.log('location.search:'+ location.search);
        console.log('state:' , state, location.search);
        postMessage(state, location.href);
    }

    function processCSSRules() {
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


                    if (parts[1] === WHEN){
                        console.log('processing WHEN selector: ' + selector);
                        var target = parts[0].trim();
                        var msg = parts[2].trim().split(/\s*,\s*/).forEach(
                          function(msgKey){
                              var msgParts = msgKey.split(/[\[\]]/);
                              var state = msgParts[0];
                              var parms = msgParts[1];
                              var cssText = '';

                              console.log('binding message listener: ' + msgKey);

                              window.addEventListener('message',
                                 function(evt){
                                    console.log('event received: '+  msgKey,'evt:' ,evt.data);
                                    //console.log('event received: ', evt.data );
                                    var elms = document.querySelectorAll(target);
                                    for ( var i=0; i < elms.length; i++ ){
                                      console.log('event handled by ',elms[i].id);
                                      if ( elms[i].cssText === undefined) {
                                        elms[i].cssText = elms[i].style.cssText || '';
                                      }
                                      if ( evt.data[state] ){
                                        elms[i].style.cssText = cssRules[selector].style.cssText;
                                        //If a template css is specified as argument
                                        if ( parms ) {
                                            cssText = Object.keys(evt.data[state]).reduce(
                                                function(prev, key){
                                                  return prev.replace('${'+ key + '}',evt.data[state][key]);
                                                },parms
                                            );
                                            elms[i].style.cssText = cssText.replace(/"/g,'').replace(/=/g,': ').replace(/&/g,';\n');
                                        }
                                      } else {
                                        elms[i].style.cssText = elms[i].cssText;
                                      }
                                    }
                                 }
                              );
                          }
                        );
                    }

                    var event = parts[1];
                    if (EVENTS.indexOf(event) >= 0){
                        console.log('processing EVENT selector: ' + selector  +  'for event: ' +  event );
                        var targets = parts[0].trim();
                        var key = parts[2].trim().replace('.','/');
                        console.log('binding message events: ' + msg + ' to ' +  targets);
                        var elms = document.querySelectorAll(targets);
                        for ( var i=0; i < elms.length; i++ ){
                            console.log('adding eventlistener for ' + key);
                            elms[i].addEventListener(event, makeEventListener(key));
                        }

                    }
                }

            }
        );
    }

    function makeEventListener (msg){
        return function(evt) {
            location.hash = msg;
            var state = msg;
            var parms = '';
            var keys = [];
            var match = msg.match(/\[(\w+)\]$/);
            //copy the specified (attribute) value into the hash param
            if (match && match[1] !== undefined ) {
                keys = match[1].split(',');
                parms = '?' + keys.map(function (key) {
                    var val = evt.srcElement[key] || evt.srcElement.getAttribute(key);
                    return key + '=' + val;

                }).join('&');

                state = msg.split('[')[0];
            }

            if ( state.indexOf('.') === 0 ) {
                location.hash +=  state.replace('.','/') + parms;
            } else {
                location.hash = state + parms;
            }
            console.log('new Hash: ' + location.hash );

        };
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
