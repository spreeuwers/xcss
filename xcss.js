/*global console,fetch*/
(function xcss() {

    "use strict";
    var allCSSRules = {};
    var visitedRules = {};
    var evtBindings = {};
    var classBindings = {};
    var contentBindings = {};
    var stateListeners = [];
    var WHEN = 'when';
    var AND = 'and';
    var EXTENDS = 'extends';
    var APPLIES = 'applies';
    var EVENTS = [];
    var LOGICAL = 'LOGICAL';

    var KEYWORD_FUNCTIONS = {
        EXTENDS: extendRule,
        APPLIES: applyRule,
        COMPONENT:componentRule,
        WHEN: stateRule,
        AND: LogicKeyword,
        OR: LogicKeyword
    };

    //fetch all possible events
    for (var evtKey in HTMLElement.prototype) {
        if (evtKey.indexOf('on') === 0) {
            EVENTS.push(evtKey.substr(2).toUpperCase() );
            //console.log(evtKey);
        }
    }
    //make keyword split expression
    var keyWordsRegExp = Object.keys(KEYWORD_FUNCTIONS).concat(EVENTS).join('|');
    var KEYWORDS = new RegExp('\\s+(' + keyWordsRegExp + '),?\\s+', 'i');
    var EVENTEXPR = new RegExp('\\W+on('+ EVENTS.join('|') + ')\\W*=\\W*[\'\"]','i');
    var SCRIPTEXPR = /<script[>\W]/i;
    var styleSheet = addNewStylesheet();
    var components={};

    document.addEventListener('DOMContentLoaded', processCSSRules);
    window.addEventListener('hashchange', stateChanged);
    stateChanged();
    return;

    function stateChanged() {
        //var state = {};
        var state = location.hash.replace(/^#/,'').split('/').map(
            function(state){
                var parts = state.split('?');
                var parms = (parts[1] || '').split('&');
                var path = parts[0];
                var result = {};
                result[path]={};
                parms.forEach(function (parm) {
                    var keyVal = parm.split('=');
                    var key = keyVal[0];
                    var val = keyVal[1];
                    result[path][key] = val;

                });
                return result;
            }
        );
        //collect path
        state.path = state.map(function(s){return Object.keys(s)[0];}).join('/');
        //collect all parameters
        state.params = {};
        state.forEach(
            function(s){
                var parms = s[Object.keys(s)[0]];
                Object.keys(parms).forEach(
                    function(k){
                        state.params[k] = parms[k];
                    }
                );
            }
        );

        console.log('state:', state);
        //postMessage(state, location.href);
        stateListeners.forEach(
            function (listener){
                listener(state);
            }
        );

        window.setTimeout(
            function(){
                bindAllEvents();
                bindAllClasses();
            },100
        );

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

    function bindAllClasses() {
        Object.keys(classBindings).forEach(
            function (target) {
                var targetElms = document.querySelectorAll(target)||[];
                var sources = classBindings[target]||[];
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
        );

    }

    /**
     *
     */
    function processCSSRules() {
        //collect all style rules
        console.time('processCSSRules');
        collectRules(document);
        compileRules(allCSSRules);
        console.timeEnd('processCSSRules');
    }

    /**
     *
     * @param cssRules
     */
    function compileRules(cssRules) {
        Object.keys(cssRules).forEach(
            function (selector) {
                var keyword, target, source, newCssText, sources, targetElms, invalidKeyword, ucKeyword,lcKeyword;
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
                    lcKeyword = keyword.toLowerCase();
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

                    else if (EVENTS.indexOf(ucKeyword) >= 0) {
                        eventRule(cssRules, selector, target, sources, lcKeyword);

                    }
                } else if (cssRules[selector].style.content){
                    insertContent(cssRules, selector, target, sources, keyword);
                }

            }
        );
    }


    function insertContent(cssRules, selector, target, sources, keyword){
        if ( ! /:(before|after)/.test(selector) ) {
            var targetElms = document.querySelectorAll(selector);
            contentBindings[selector] = cssRules[selector].style.content;
            console.log('inserting content for: ' + selector);
            [].slice.call(targetElms).forEach(
                function (elm) {
                  elm.innerHTML = cssRules[selector].style.content.slice(1,-1);
                }
            );
        }
    }

    function componentRule(cssRules, selector, target, sources, keyword) {
        //make multiple registrations possible
        var registered = {};
        var key;
        var proto = Object.create(HTMLElement.prototype);

        var comp = {};
        var tplExpr = /\[template(Id|Url)="([\w-\/\.]*)"\]/i;
        var template = sources[0].match(tplExpr);
        //extract url of id
        if(template){
           comp.template ={};
           template.shift();
           key =template.shift().toLowerCase();
           comp.template[key] = template.shift();
        } else {
            comp.content = cssRules[selector].style.content.replace(/^"/, '').replace(/"$/, '');
        }


        components[target.toUpperCase()]=comp;
        //default templateid = name of tag
        proto.createdCallback = function () {
            // Adding a Shadow DOM
            var root = this.createShadowRoot();
            var comp = components[this.tagName];
            // Adding a template
            if(comp.template){
                if (comp.template.id) {
                    var tpl = document.querySelector('#' + comp.template.id);
                    var clone = document.importNode(tpl.content, true);
                    root.appendChild(clone);
                } else if (comp.template.url){
                    fetch(comp.template.url).then(
                        function(response){
                            return response.text();
                        }
                    ).then(
                        function(html){
                            root.innerHTML = html;
                        }
                    )

                }

            } else {
                root.innerHTML = comp.content;
            }
        }
        document.registerElement(target, {
            prototype: proto
        });
        var self = cssRules[selector];
        styleSheet.insertRule(target + '{' + self.style.cssText + '}', styleSheet.cssRules.length);

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
                    console.debug('Resolved rule fromSelector: ' + fromSelector + ' = ' + cssRules[fromSelector].style.cssText);
                }
                return (cssRules[fromSelector]) ? cssRules[fromSelector].style.cssText : '';
            }
        ).join(' ');

        var self = cssRules[selector];
        console.log('adding rule: ' + target + '{' + self.style.cssText + newCssText + '}');
        var idx = styleSheet.insertRule(target + '{' + self.style.cssText + newCssText + '}', styleSheet.cssRules.length);
        cssRules[target] = styleSheet.cssRules[idx];
    }

    /**
     * adds found classes after keyword APPLIES to the elements for the selector
     * @param cssRules
     * @param selector
     * @param target
     * @param sources
     * @param keyword
     */
    function applyRule(cssRules, selector, target, sources, keyword) {

        var targetElms = document.querySelectorAll(target);
        classBindings[target] = sources;
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

        console.log('binding message listener: ' + sources);
        stateListeners.push(makeStateChangeListener(target, sources, selector, cssRules));

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
    function LogicKeyword() {

    }


    function makeStateChangeListener(targetKey, sources, selector, cssRules) {

        console.log('makeStateChangeListener for: ' + targetKey + ', sources: ' + sources);

        var targetStates = sources.map(
            function(source){
                var parts = source.split(/[\[\]]/);
                var path = parts.shift().trim();
                var pattern = path.replace(/\s*\*\s*/g, '.*').replace(/>/g, '\/');
                return {
                    path:path,
                    pattern: new RegExp('^' + pattern + '$'),
                    params:parts.filter(function (p) {return !!p.trim(); }) //filter out empty parms
                };
            }
        );

        //var stateKey = msgParts[0];
        //var parms = msgParts[1];
        var cssText = '';
        var target = targetKey + '';

        return stateChangeListener;

        ////////////////////////////////////////////////////////

        function stateChangeListener(newState) {
            var matches,parms;

            console.log('event received: ' + targetKey, 'evt:', newState);
            var path = newState.path;
            var state = newState.params;

            //replace parameter placeholders in target selector with state parameter values
            var elmQuery = target;
            Object.keys(state).forEach(
                function(key){
                    elmQuery = elmQuery.replace('${' + key + '}', state[key]);
                }
            );


            var elms = document.querySelectorAll(elmQuery);
            for (var i = 0; i < elms.length; i++) {
                var elm = elms[i];
                console.log('event handled by ', elm.id);
                if (elm.cssText === undefined) {
                    elm.cssText = elm.style.cssText || '';
                }

                var content = cssRules[selector].style.content;
                var match = targetStates.filter(function(s){return s.pattern.test(path);});

                if (match = match[0]) {
                    parms = match.params;
                    //filter content property out before adding the cssText
                    cssText = cssRules[selector].style.cssText.split('; ').filter(
                        function(cssLine){
                            return cssLine.trim().indexOf('content:') < 0;
                        }
                    ).join('\n');
                    elm.style.cssText = cssText.replace(/\$\{[^\}]*\}/g, function(v) {
                        return state[v.substring(2,v.length-1)];
                    });

                    ////copy all styles from the stylesheet rule
                    //Object.keys(cssRules[selector].style).forEach(
                    //    function (styleKey){
                    //        if (styleKey === 'content'){
                    //            return;
                    //        }
                    //        elm.style[styleKey] = cssRules[selector].style[styleKey];
                    //    }
                    //);
                    //then overwrite the defined style poroperties  with a templated  value
                    parms.forEach(
                        function( parm){
                            var parts = parm.split('=');
                            if (parts.length !== 2) {
                                return;
                            }
                            var cssKey = parts.shift();
                            var jsKey = cssKey.replace(/(-\w)/, function(v) { return v.substring(1).toUpperCase(); });
                            if (elm.style[jsKey] === undefined){
                                console.warn('Trying to set a style key:' + cssKey + ' that does not exsist!');
                                return;
                            }

                            var value = (parts.shift()||'').replace(/^['"]/,'').replace(/['"]$/,'');
                            if (value){
                                value = value.replace(/\$\{[^\}]*\}/g, function(v) {
                                    return state[v.substring(2,v.length-1)];
                                });
                                elm.style[jsKey] = value;
                            }
                        }
                    );




                    if (content) {
                        var placeholder = new RegExp('\\$\\{' + parms + '\\}', 'g');
                        var replacer = (state || {})[parms] || '';

                        content = content.replace(placeholder, replacer);
                        if (matches = content.match(/^url\(['"]([^)]*)['"]\)$/)) {


                            fetch(matches[1]).then(
                                function (response) {

                                    response.text().then(function (data) {
                                        console.log(data);
                                        if (SCRIPTEXPR.test(data) || EVENTEXPR.test(data)) {
                                            console.error('unsafe content ignored!');
                                        } else {

                                            if (elm.tagName === "input" || elm.tagName === 'textarea') {
                                                if (!Array.isArray(elm.orgValue)){
                                                    elm.orgValue = [elm.value];
                                                }
                                                elm.value = data;
                                            } else {
                                                //if we has a change in the html rebind all events if needed
                                                //so events bind seems to work as styles whenever an element
                                                //matches the css rule the event is present
                                                if (!Array.isArray(elm.orgValue)){
                                                    elm.orgValue = [elm.innerHTML];
                                                }
                                                //only update if needed so we keep element events working
                                                //no need to bind events again
                                                if (data !== elm.dataHtml){
                                                    elm.innerHTML = data;
                                                    elm.dataHtml = data;
                                                }
                                            }
                                        }


                                    });
                                }
                            );
                        } else if (matches = content.match(/^"([^"]*)"$/)) {
                            var html = matches[1];

                            if (SCRIPTEXPR.test(html) || EVENTEXPR.test(html)) {
                                console.error('unsafe content ignored!');
                            } else {
                                if (elm.tagName === "input" || elm.tagName === 'textarea') {
                                    if (!Array.isArray(elm.orgValue)){
                                        elm.orgValue = [elm.value];
                                    }
                                    elm.value = html;
                                } else {
                                    if (!Array.isArray(elm.orgValue)) {
                                        elm.orgValue = [elm.innerHTML];
                                    }
                                    elm.innerHTML = html;
                                }
                                //if we has a change in the html rebind all events if needed
                                //so events bind seems to work as styles whenever an element
                                //matches the css rule the event is present

                            }
                        }
                    }
                } else {
                    elms[i].style.cssText = elms[i].cssText;
                    if (content && Array.isArray(elm.orgValue)){
                        var p =(['input','textarea'].indexOf(elm.tagName) < 0 ) ? 'innerHTML' : 'value';
                        elm[p] = elm.orgValue[0];
                        elm.dataHtml = elm.orgValue[0];

                    }
                }

            }

        }

    }


    function makeEventListener(msg) {
        return function xcssHandler(elmEvent) {
            var prevPath;
            var hash = msg.split('[')[0];
            var parms = '';
            var prefix = '?'
            var keys = [];
            var match = msg.match(/\[([\w-]+)\]$/);
            var elm = elmEvent.currentTarget||elmEvent.srcElement;
            //copy the specified (attribute) value into the hash param
            if (match && match[1] !== undefined) {
                keys = match[1].split(',');
                // if (firstParm = location.hash.split('?')[1]){
                //     prefix += firstParm + '&';
                // }
                parms = prefix + keys.map(function (key) {
                    var val = elm[key] || elm.getAttribute(key);
                    return key + '=' + val;

                }).join('&');


            }

            var parts = location.hash.replace(/^#/,'').split('/').map(function(p){return p.split('?')[0]});
            var path = hash.replace(/^[#>+~\.\/]/,'').trim();
            var pathPos = parts.indexOf(path);
            var prevHash = location.hash.replace(/^#/,'').split('/');

            if (hash.indexOf('+') === 0) {
                //add state name to path
               if (pathPos >= 0){
                    prevHash.pop();
                }
                prevHash.push(path);
                location.hash = prevHash.join('/') + parms;

            } else if (hash.indexOf('~') === 0) {
                //delete state name from path
                if (path === '*'){
                    pathPos = prevHash.length-1;
                }
                if (pathPos >= 0){
                    location.hash = prevHash.filter(function(x,i){return i !== pathPos; }).join('/');
                }
            } else if (hash.indexOf('>') === 0) {
                //replace last state name in path
                var prevPath = prevHash.pop();
                if (hash.indexOf('.') < 0){  //this means toggle the path
                    prevHash.push(path);
                } else {
                    if (prevPath !== path){
                        prevHash.push(prevPath);
                        prevHash.push(path);
                    }
                }
                location.hash = prevHash.join('/') + parms;
            } else if (hash.indexOf('.') === 0) {
                //allways add
                prevHash.push(path);
                location.hash = prevHash.join('/') + parms;
            } else {
                location.hash = hash + parms;
            }
            console.log('new Hash: ' + location.hash);

        };
    }

    function collectRules(container) {
        [].slice.call(container.styleSheets || []).forEach(
            function (styleSheet) {
                if ( (styleSheet.href||'').indexOf(window.location.origin) === 0 ) {

                    [].slice.call(styleSheet.cssRules || []).forEach(
                        function (cssRule) {
                            allCSSRules[cssRule.selectorText] = cssRule;
                        }
                    );
                }
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
