/*global console,fetch*/
(function xcss() {

    "use strict";
    var allCSSRules = {};
    var visitedRules = {};
    var evtBindings = {};
    var WHEN = 'when';
    var AND = 'and';
    var EXTENDS = 'extends';
    var APPLIES = 'applies';
    var EVENTS = [];
    var LOGICAL = 'LOGICAL';

    var KEYWORD_FUNCTIONS = {
        EXTENDS: extendRule,
        APPLIES: applyRule,
        WHEN: stateRule,
        AND: LogicKeyword,
        OR: LogicKeyword
    };

    //fetch all possible events
    for (var evtKey in HTMLElement.prototype) {
        if (evtKey.indexOf('on') === 0) {
            EVENTS.push(evtKey.substr(2));
            //console.log(evtKey);
        }
    }
    //make keyword split expression
    var keyWordsRegExp = Object.keys(KEYWORD_FUNCTIONS).concat(EVENTS).join('|');
    var KEYWORDS = new RegExp('\\s+(' + keyWordsRegExp + ')\\s+', 'i');
    var styleSheet = addNewStylesheet();

    document.addEventListener('DOMContentLoaded', processCSSRules);
    window.addEventListener('hashchange', stateChanged);
    stateChanged();
    return;

    function stateChanged() {
        var state = {};
        var parts = location.hash.split('?');
        var path = parts[0].replace(/#\/?/, '');
        var parms = (parts[1] || '').split('&');
        var result = state[path] = {};
        console.log('path:' + path);


        parms.forEach(function (parm) {
            var keyVal = parm.split('=');
            var key = keyVal[0];
            var val = keyVal[1];
            if (key) {
                if (/<script/i.test(val)) {
                    //prevent injection
                    console.error('script tag not allowed!');
                } else {
                    result[key] = val;
                }
            }
        });
        console.log('state:', state);
        postMessage(state, location.href);
    }


    function bindAllEvents() {
        Object.keys(evtBindings).forEach(
            function bind(target) {
                //console.log('binding message events: ' + msg + ' to ' +  targets);
                var elms = document.querySelectorAll(target);
                for (var i = 0; i < elms.length; i++) {
                    //elms[i].addEventListener(event, makeEventListener(key));
                    var handler = evtBindings[target];
                    if (!elms[i].xcssHandler) {
                        console.log('binding message events: ' + handler.hash + ' to ' + target);
                        elms[i].xcssHandler = makeEventListener(handler.hash);
                        elms[i].addEventListener(handler.event, elms[i].xcssHandler);
                    }


                }
            }
        );
    }

    /**
     *
     */
    function processCSSRules() {
        //collect all style rules
        console.time('inheritCSSRules');
        collectRules(document);
        compileRules(allCSSRules);
        console.timeEnd('inheritCSSRules');
    }

    /**
     *
     * @param cssRules
     */
    function compileRules(cssRules) {
        Object.keys(cssRules).forEach(
            function (selector) {
                var keyword, target, source, newCssText, sources,targetElms,invalidKeyword,ucKeyword;
                var parts = selector.split(KEYWORDS);

                if (visitedRules[selector]) {
                    //console.log('skipping visited selector: ' + selector);
                    return;
                }
                visitedRules[selector] = cssRules[selector];

                console.log('parts: [' + parts.join(' : '), '] selector:', selector);

                //initially the rule is valid
                invalidKeyword = '';

                if (parts.length > 2) {
                    //read first thre fields
                    target = parts.shift().trim();
                    keyword = parts.shift().trim();
                    ucKeyword = keyword.toUpperCase();

                    sources = parts.filter(
                        function (part) {
                            var keywordType = KEYWORD_FUNCTIONS[part.toUpperCase()];
                            invalidKeyword = (keywordType && LogicKeyword !== keywordType) ? keyword : invalidKeyword;
                            return !keywordType;
                        }
                    );

                    if (invalidKeyword) {
                        console.error('cannot proces invalid xcss rule: "' + selector + '" unexpected keyword "' + invalidKeyword + '"');
                        return;
                    }


                    if (KEYWORD_FUNCTIONS[ucKeyword]) {
                        //apply the right function for a keyword
                        KEYWORD_FUNCTIONS[ucKeyword](cssRules, selector, target, sources, keyword);
                    }

                    else if (EVENTS.indexOf(keyword) >= 0) {
                        eventRule(cssRules, selector, target, sources, keyword);

                    }
                }

            }
        );
    }

    /**
    */
    function extendRule(cssRules, selector, target, sources, keyword) {

        var newCssText = sources.map(
            function (fromSelector) {
                //resolve fromSelector when not found in currenttly resolved rules
                if (!cssRules[fromSelector]) {
                    console.log('resolving rule fromSelector: ' + fromSelector);
                    compileRules(cssRules);
                }
                if (!cssRules[fromSelector]) {
                    console.error('Could not resolve rule fromSelector: ' + fromSelector);
                } else {
                    console.debug('Resolved rule fromSelector: ' + fromSelector + ' = ' +  cssRules[fromSelector].style.cssText );
                }
                return (cssRules[fromSelector]) ? cssRules[fromSelector].style.cssText : '';
            }
        ).join(' ');

        var self = cssRules[selector];
        console.log('adding rule: ' + target + '{' + self.style.cssText + newCssText + '}');
        var idx = styleSheet.insertRule(target + '{' + self.style.cssText + newCssText + '}', styleSheet.cssRules.length);
        cssRules[target] = styleSheet.cssRules[idx];
    }


    function applyRule(cssRules, selector, target, sources, keyword) {

         var targetElms = document.querySelectorAll(target);
        [].slice.call(targetElms).forEach(
            function (elm) {
                sources.forEach(
                    function (className) {
                        console.log('applying ' + className + ' to ' + target);
                        elm.classList.add(className);

                    }
                );
            }
        );
    }

    /**
     *
     * @param cssRules
     * @param selector
     * @param target
     * @param sources
     * @param keyword
     */
    function stateRule(cssRules, selector, target, sources, keyword) {
        console.log('binding message WHEN listener: ' + sources + ' to ' + selector);

        sources.forEach(
            function (hashState) {
                console.log('binding message listener: ' + hashState);
                window.addEventListener('message', makeStateChangeListener(target, hashState, selector, cssRules));
            }
        );
    }

    /**
     *
     * @param cssRules
     * @param selector
     * @param target
     * @param sources
     * @param keyword
     */
    function eventRule(cssRules, selector, target, sources, keyword) {
        var newHash = sources[0] || keyword;
        console.log('binding message events: ' + newHash + ' to ' + target + ' for ' + keyword);
        evtBindings[target] = {hash: newHash, event: keyword};
        var targetElms = document.querySelectorAll(target);
        [].slice.call(targetElms).forEach(
            function (elm) {
                console.log('adding eventlistener for ' + newHash);
                elm.xcssHandler = makeEventListener(newHash);
                elm.addEventListener(keyword, elm.xcssHandler);
            }
        );

    }

    /**
     * logicRule is a marker function
    */
    function LogicKeyword(){

    }




    function makeStateChangeListener(targetKey, msgKey, selector, cssRules) {

        console.log('makeStateChangeListener for: ' + targetKey + ', msgKey: ' + msgKey);

        var msgParts = msgKey.split(/[\[\]]/);
        var state = msgParts[0];
        var parms = msgParts[1];
        var cssText = '';
        var target = targetKey + '';

        return stateChangeListener;

        ////////////////////////////////////////////////////////

        function stateChangeListener(msgEvent) {
            var contentExpr = /content\s*:\s*('[^']*'|"[^"]*")/;
            console.log('event received: ' + msgKey, 'evt:', msgEvent.data);

            if ( msgEvent.origin !== window.location.origin){
                console.error('untrusted event received from other domain: ', msgEvent);
                return;
            }
            if (msgEvent.source !== window){
                console.error('untusted event received from other window: ', msgEvent);
                return;
            }

            //console.log('event received: ', evt.data );
            var elms = document.querySelectorAll(target);
            for (var i = 0; i < elms.length; i++) {
                console.log('event handled by ', elms[i].id);
                if (elms[i].cssText === undefined) {
                    elms[i].cssText = elms[i].style.cssText || '';
                }
                var pattern = new RegExp('^' + msgKey.split('[')[0].trim().replace(/\s*\*\s*/g, '.*').replace(/>/g, '\/') + '$');
                var path = Object.keys(msgEvent.data || {})[0] || '';
                if (pattern.test(path)) {
                    elms[i].style.cssText = cssRules[selector].style.cssText;
                    //If a template css is specified as argument
                    if (parms) {
                        cssText = Object.keys(msgEvent.data[state]).reduce(
                            function (prev, key) {
                                return prev.replace('${' + key + '}', msgEvent.data[state][key]);
                            }, parms
                        );
                        var newCssText = cssText.replace(/["']/g, '').replace(/=/g, ': ').replace(/&/g, ';\n');
                        elms[i].style.cssText = newCssText;

                        var matches = cssRules[selector].style.cssText.match(contentExpr);
                        if (matches && matches[1]) {
                            var content = matches[1];
                            var placeholder = new RegExp('\\$\\{' + parms + '\\}', 'g');
                            var replacer = msgEvent.data[state][parms];
                            var elm = elms[i];
                            content = content.replace(placeholder, replacer);
                            if (matches = content.match(/^"fetch\('([^)]*)'\)"$/)) {
                                fetch(matches[1]).then(
                                    function (response) {

                                        response.text().then(function (data) {
                                            console.log(data);
                                            if ( /<script[>\s]/i.test(data) ){
                                                console.error('unsave content ignored!');
                                            } else {

                                                if (elm.tagName === "input" || elm.tagName === 'textarea') {
                                                    elm.value = data;
                                                } else {
                                                    //if we has a change in the html rebind all events if needed
                                                    //so events bind seems to work as styles whenever an element
                                                    //matches the css rule the event is present
                                                    elm.innerHTML = data;
                                                    bindAllEvents();
                                                }
                                            }


                                        });
                                    }
                                );
                            } else {
                                var html = content.split(/[''"]/)[1]
                                if (elm.tagName === "input" || elm.tagName === 'textarea') {
                                    elm.value = html;
                                } else {
                                    elm.innerHTML = html;
                                }
                                //if we has a change in the html rebind all events if needed
                                //so events bind seems to work as styles whenever an element
                                //matches the css rule the event is present
                                bindAllEvents();
                            }
                        }
                    }
                } else {
                    elms[i].style.cssText = elms[i].cssText;
                }
            }

        }

    }


    function makeEventListener(msg) {
        return function xcssHandler(elmEvent) {
            var pattern;
            var hash = msg.replace(/\./g, '/');
            var parms = '';
            var keys = [];
            var match = msg.match(/\[([\w-]+)\]$/);
            //copy the specified (attribute) value into the hash param
            if (match && match[1] !== undefined) {
                keys = match[1].split(',');
                parms = '?' + keys.map(function (key) {
                    var val = elmEvent.srcElement[key] || elmEvent.srcElement.getAttribute(key);
                    return key + '=' + val;

                }).join('&');

                hash = msg.split('[')[0];
            }

            if (hash.indexOf('/') === 0) {
                //add state name to path
                location.hash = location.hash.split('?')[0] + hash + parms;
            } else if (hash.indexOf('~') === 0) {
                //delete state name from path
                pattern = (hash || '').replace(/~\s*/, '/');
                location.hash = (location.hash || '').replace(pattern, '');
            } else if (hash.indexOf('>') === 0) {
                 //replace last state name in path
                 pattern = (hash || '').replace(/>\s*/, '/');
                location.hash = location.hash.split('?')[0].split('/').slice(0,-1).join('/').replace(/[\/]+$/,'') + pattern;
            } else {
                location.hash = hash + parms;
            }
            console.log('new Hash: ' + location.hash);

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
