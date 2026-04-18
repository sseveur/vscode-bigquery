/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Fragment: () => (/* reexport safe */ preact__WEBPACK_IMPORTED_MODULE_0__.Fragment),
/* harmony export */   jsx: () => (/* binding */ u),
/* harmony export */   jsxAttr: () => (/* binding */ l),
/* harmony export */   jsxDEV: () => (/* binding */ u),
/* harmony export */   jsxEscape: () => (/* binding */ s),
/* harmony export */   jsxTemplate: () => (/* binding */ a),
/* harmony export */   jsxs: () => (/* binding */ u)
/* harmony export */ });
/* harmony import */ var preact__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
var t=/["&<]/;function n(r){if(0===r.length||!1===t.test(r))return r;for(var e=0,n=0,o="",f="";n<r.length;n++){switch(r.charCodeAt(n)){case 34:f="&quot;";break;case 38:f="&amp;";break;case 60:f="&lt;";break;default:continue}n!==e&&(o+=r.slice(e,n)),o+=f,e=n+1}return n!==e&&(o+=r.slice(e,n)),o}var o=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,f=0,i=Array.isArray;function u(e,t,n,o,i,u){t||(t={});var a,c,p=t;if("ref"in p)for(c in p={},t)"ref"==c?a=t[c]:p[c]=t[c];var l={type:e,props:p,key:n,ref:a,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--f,__i:-1,__u:0,__source:i,__self:u};if("function"==typeof e&&(a=e.defaultProps))for(c in a)void 0===p[c]&&(p[c]=a[c]);return preact__WEBPACK_IMPORTED_MODULE_0__.options.vnode&&preact__WEBPACK_IMPORTED_MODULE_0__.options.vnode(l),l}function a(r){var t=u(preact__WEBPACK_IMPORTED_MODULE_0__.Fragment,{tpl:r,exprs:[].slice.call(arguments,1)});return t.key=t.__v,t}var c={},p=/[A-Z]/g;function l(e,t){if(preact__WEBPACK_IMPORTED_MODULE_0__.options.attr){var f=preact__WEBPACK_IMPORTED_MODULE_0__.options.attr(e,t);if("string"==typeof f)return f}if(t=function(r){return null!==r&&"object"==typeof r&&"function"==typeof r.valueOf?r.valueOf():r}(t),"ref"===e||"key"===e)return"";if("style"===e&&"object"==typeof t){var i="";for(var u in t){var a=t[u];if(null!=a&&""!==a){var l="-"==u[0]?u:c[u]||(c[u]=u.replace(p,"-$&").toLowerCase()),s=";";"number"!=typeof a||l.startsWith("--")||o.test(l)||(s="px;"),i=i+l+":"+a+s}}return e+'="'+n(i)+'"'}return null==t||!1===t||"function"==typeof t||"object"==typeof t?"":!0===t?e:e+'="'+n(""+t)+'"'}function s(r){if(null==r||"boolean"==typeof r||"function"==typeof r)return null;if("object"==typeof r){if(void 0===r.constructor)return r;if(i(r)){for(var e=0;e<r.length;e++)r[e]=s(r[e]);return r}}return n(""+r)}
//# sourceMappingURL=jsxRuntime.module.js.map


/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Component: () => (/* binding */ x),
/* harmony export */   Fragment: () => (/* binding */ k),
/* harmony export */   cloneElement: () => (/* binding */ K),
/* harmony export */   createContext: () => (/* binding */ Q),
/* harmony export */   createElement: () => (/* binding */ _),
/* harmony export */   createRef: () => (/* binding */ b),
/* harmony export */   h: () => (/* binding */ _),
/* harmony export */   hydrate: () => (/* binding */ J),
/* harmony export */   isValidElement: () => (/* binding */ t),
/* harmony export */   options: () => (/* binding */ l),
/* harmony export */   render: () => (/* binding */ G),
/* harmony export */   toChildArray: () => (/* binding */ H)
/* harmony export */ });
var n,l,u,t,i,r,o,e,f,c,s,a,h,p={},v=[],y=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,w=Array.isArray;function d(n,l){for(var u in l)n[u]=l[u];return n}function g(n){n&&n.parentNode&&n.parentNode.removeChild(n)}function _(l,u,t){var i,r,o,e={};for(o in u)"key"==o?i=u[o]:"ref"==o?r=u[o]:e[o]=u[o];if(arguments.length>2&&(e.children=arguments.length>3?n.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(o in l.defaultProps)void 0===e[o]&&(e[o]=l.defaultProps[o]);return m(l,e,i,r,null)}function m(n,t,i,r,o){var e={type:n,props:t,key:i,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:null==o?++u:o,__i:-1,__u:0};return null==o&&null!=l.vnode&&l.vnode(e),e}function b(){return{current:null}}function k(n){return n.children}function x(n,l){this.props=n,this.context=l}function S(n,l){if(null==l)return n.__?S(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return"function"==typeof n.type?S(n):null}function C(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return C(n)}}function M(n){(!n.__d&&(n.__d=!0)&&i.push(n)&&!$.__r++||r!=l.debounceRendering)&&((r=l.debounceRendering)||o)($)}function $(){for(var n,u,t,r,o,f,c,s=1;i.length;)i.length>s&&i.sort(e),n=i.shift(),s=i.length,n.__d&&(t=void 0,r=void 0,o=(r=(u=n).__v).__e,f=[],c=[],u.__P&&((t=d({},r)).__v=r.__v+1,l.vnode&&l.vnode(t),O(u.__P,t,r,u.__n,u.__P.namespaceURI,32&r.__u?[o]:null,f,null==o?S(r):o,!!(32&r.__u),c),t.__v=r.__v,t.__.__k[t.__i]=t,N(f,t,c),r.__e=r.__=null,t.__e!=o&&C(t)));$.__r=0}function I(n,l,u,t,i,r,o,e,f,c,s){var a,h,y,w,d,g,_,m=t&&t.__k||v,b=l.length;for(f=P(u,l,m,f,b),a=0;a<b;a++)null!=(y=u.__k[a])&&(h=-1==y.__i?p:m[y.__i]||p,y.__i=a,g=O(n,y,h,i,r,o,e,f,c,s),w=y.__e,y.ref&&h.ref!=y.ref&&(h.ref&&B(h.ref,null,y),s.push(y.ref,y.__c||w,y)),null==d&&null!=w&&(d=w),(_=!!(4&y.__u))||h.__k===y.__k?f=A(y,f,n,_):"function"==typeof y.type&&void 0!==g?f=g:w&&(f=w.nextSibling),y.__u&=-7);return u.__e=d,f}function P(n,l,u,t,i){var r,o,e,f,c,s=u.length,a=s,h=0;for(n.__k=new Array(i),r=0;r<i;r++)null!=(o=l[r])&&"boolean"!=typeof o&&"function"!=typeof o?("string"==typeof o||"number"==typeof o||"bigint"==typeof o||o.constructor==String?o=n.__k[r]=m(null,o,null,null,null):w(o)?o=n.__k[r]=m(k,{children:o},null,null,null):null==o.constructor&&o.__b>0?o=n.__k[r]=m(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):n.__k[r]=o,f=r+h,o.__=n,o.__b=n.__b+1,-1!=(c=o.__i=L(o,u,f,a))&&(a--,(e=u[c])&&(e.__u|=2)),null==e||null==e.__v?(-1==c&&(i>s?h--:i<s&&h++),"function"!=typeof o.type&&(o.__u|=4)):c!=f&&(c==f-1?h--:c==f+1?h++:(c>f?h--:h++,o.__u|=4))):n.__k[r]=null;if(a)for(r=0;r<s;r++)null!=(e=u[r])&&0==(2&e.__u)&&(e.__e==t&&(t=S(e)),D(e,e));return t}function A(n,l,u,t){var i,r;if("function"==typeof n.type){for(i=n.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=n,l=A(i[r],l,u,t));return l}n.__e!=l&&(t&&(l&&n.type&&!l.parentNode&&(l=S(n)),u.insertBefore(n.__e,l||null)),l=n.__e);do{l=l&&l.nextSibling}while(null!=l&&8==l.nodeType);return l}function H(n,l){return l=l||[],null==n||"boolean"==typeof n||(w(n)?n.some(function(n){H(n,l)}):l.push(n)),l}function L(n,l,u,t){var i,r,o,e=n.key,f=n.type,c=l[u],s=null!=c&&0==(2&c.__u);if(null===c&&null==e||s&&e==c.key&&f==c.type)return u;if(t>(s?1:0))for(i=u-1,r=u+1;i>=0||r<l.length;)if(null!=(c=l[o=i>=0?i--:r++])&&0==(2&c.__u)&&e==c.key&&f==c.type)return o;return-1}function T(n,l,u){"-"==l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||y.test(l)?u:u+"px"}function j(n,l,u,t,i){var r,o;n:if("style"==l)if("string"==typeof u)n.style.cssText=u;else{if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||T(n.style,l,"");if(u)for(l in u)t&&u[l]==t[l]||T(n.style,l,u[l])}else if("o"==l[0]&&"n"==l[1])r=l!=(l=l.replace(f,"$1")),o=l.toLowerCase(),l=o in n||"onFocusOut"==l||"onFocusIn"==l?o.slice(2):l.slice(2),n.l||(n.l={}),n.l[l+r]=u,u?t?u.u=t.u:(u.u=c,n.addEventListener(l,r?a:s,r)):n.removeEventListener(l,r?a:s,r);else{if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||!1===u&&"-"!=l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==u?"":u))}}function F(n){return function(u){if(this.l){var t=this.l[u.type+n];if(null==u.t)u.t=c++;else if(u.t<t.u)return;return t(l.event?l.event(u):u)}}}function O(n,u,t,i,r,o,e,f,c,s){var a,h,p,v,y,_,m,b,S,C,M,$,P,A,H,L,T,j=u.type;if(null!=u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),o=[f=u.__e=t.__e]),(a=l.__b)&&a(u);n:if("function"==typeof j)try{if(b=u.props,S="prototype"in j&&j.prototype.render,C=(a=j.contextType)&&i[a.__c],M=a?C?C.props.value:a.__:i,t.__c?m=(h=u.__c=t.__c).__=h.__E:(S?u.__c=h=new j(b,M):(u.__c=h=new x(b,M),h.constructor=j,h.render=E),C&&C.sub(h),h.state||(h.state={}),h.__n=i,p=h.__d=!0,h.__h=[],h._sb=[]),S&&null==h.__s&&(h.__s=h.state),S&&null!=j.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=d({},h.__s)),d(h.__s,j.getDerivedStateFromProps(b,h.__s))),v=h.props,y=h.state,h.__v=u,p)S&&null==j.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),S&&null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else{if(S&&null==j.getDerivedStateFromProps&&b!==v&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(b,M),u.__v==t.__v||!h.__e&&null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(b,h.__s,M)){for(u.__v!=t.__v&&(h.props=b,h.state=h.__s,h.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.some(function(n){n&&(n.__=u)}),$=0;$<h._sb.length;$++)h.__h.push(h._sb[$]);h._sb=[],h.__h.length&&e.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(b,h.__s,M),S&&null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(v,y,_)})}if(h.context=M,h.props=b,h.__P=n,h.__e=!1,P=l.__r,A=0,S){for(h.state=h.__s,h.__d=!1,P&&P(u),a=h.render(h.props,h.state,h.context),H=0;H<h._sb.length;H++)h.__h.push(h._sb[H]);h._sb=[]}else do{h.__d=!1,P&&P(u),a=h.render(h.props,h.state,h.context),h.state=h.__s}while(h.__d&&++A<25);h.state=h.__s,null!=h.getChildContext&&(i=d(d({},i),h.getChildContext())),S&&!p&&null!=h.getSnapshotBeforeUpdate&&(_=h.getSnapshotBeforeUpdate(v,y)),L=a,null!=a&&a.type===k&&null==a.key&&(L=V(a.props.children)),f=I(n,w(L)?L:[L],u,t,i,r,o,e,f,c,s),h.base=u.__e,u.__u&=-161,h.__h.length&&e.push(h),m&&(h.__E=h.__=null)}catch(n){if(u.__v=null,c||null!=o)if(n.then){for(u.__u|=c?160:128;f&&8==f.nodeType&&f.nextSibling;)f=f.nextSibling;o[o.indexOf(f)]=null,u.__e=f}else{for(T=o.length;T--;)g(o[T]);z(u)}else u.__e=t.__e,u.__k=t.__k,n.then||z(u);l.__e(n,u,t)}else null==o&&u.__v==t.__v?(u.__k=t.__k,u.__e=t.__e):f=u.__e=q(t.__e,u,t,i,r,o,e,c,s);return(a=l.diffed)&&a(u),128&u.__u?void 0:f}function z(n){n&&n.__c&&(n.__c.__e=!0),n&&n.__k&&n.__k.forEach(z)}function N(n,u,t){for(var i=0;i<t.length;i++)B(t[i],t[++i],t[++i]);l.__c&&l.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u)})}catch(n){l.__e(n,u.__v)}})}function V(n){return"object"!=typeof n||null==n||n.__b&&n.__b>0?n:w(n)?n.map(V):d({},n)}function q(u,t,i,r,o,e,f,c,s){var a,h,v,y,d,_,m,b=i.props||p,k=t.props,x=t.type;if("svg"==x?o="http://www.w3.org/2000/svg":"math"==x?o="http://www.w3.org/1998/Math/MathML":o||(o="http://www.w3.org/1999/xhtml"),null!=e)for(a=0;a<e.length;a++)if((d=e[a])&&"setAttribute"in d==!!x&&(x?d.localName==x:3==d.nodeType)){u=d,e[a]=null;break}if(null==u){if(null==x)return document.createTextNode(k);u=document.createElementNS(o,x,k.is&&k),c&&(l.__m&&l.__m(t,e),c=!1),e=null}if(null==x)b===k||c&&u.data==k||(u.data=k);else{if(e=e&&n.call(u.childNodes),!c&&null!=e)for(b={},a=0;a<u.attributes.length;a++)b[(d=u.attributes[a]).name]=d.value;for(a in b)if(d=b[a],"children"==a);else if("dangerouslySetInnerHTML"==a)v=d;else if(!(a in k)){if("value"==a&&"defaultValue"in k||"checked"==a&&"defaultChecked"in k)continue;j(u,a,null,d,o)}for(a in k)d=k[a],"children"==a?y=d:"dangerouslySetInnerHTML"==a?h=d:"value"==a?_=d:"checked"==a?m=d:c&&"function"!=typeof d||b[a]===d||j(u,a,d,b[a],o);if(h)c||v&&(h.__html==v.__html||h.__html==u.innerHTML)||(u.innerHTML=h.__html),t.__k=[];else if(v&&(u.innerHTML=""),I("template"==t.type?u.content:u,w(y)?y:[y],t,i,r,"foreignObject"==x?"http://www.w3.org/1999/xhtml":o,e,f,e?e[0]:i.__k&&S(i,0),c,s),null!=e)for(a=e.length;a--;)g(e[a]);c||(a="value","progress"==x&&null==_?u.removeAttribute("value"):null!=_&&(_!==u[a]||"progress"==x&&!_||"option"==x&&_!=b[a])&&j(u,a,_,b[a],o),a="checked",null!=m&&m!=u[a]&&j(u,a,m,b[a],o))}return u}function B(n,u,t){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==u||(n.__u=n(u))}else n.current=u}catch(n){l.__e(n,t)}}function D(n,u,t){var i,r;if(l.unmount&&l.unmount(n),(i=n.ref)&&(i.current&&i.current!=n.__e||B(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(n){l.__e(n,u)}i.base=i.__P=null}if(i=n.__k)for(r=0;r<i.length;r++)i[r]&&D(i[r],u,t||"function"!=typeof n.type);t||g(n.__e),n.__c=n.__=n.__e=void 0}function E(n,l,u){return this.constructor(n,u)}function G(u,t,i){var r,o,e,f;t==document&&(t=document.documentElement),l.__&&l.__(u,t),o=(r="function"==typeof i)?null:i&&i.__k||t.__k,e=[],f=[],O(t,u=(!r&&i||t).__k=_(k,null,[u]),o||p,p,t.namespaceURI,!r&&i?[i]:o?null:t.firstChild?n.call(t.childNodes):null,e,!r&&i?i:o?o.__e:t.firstChild,r,f),N(e,u,f)}function J(n,l){G(n,l,J)}function K(l,u,t){var i,r,o,e,f=d({},l.props);for(o in l.type&&l.type.defaultProps&&(e=l.type.defaultProps),u)"key"==o?i=u[o]:"ref"==o?r=u[o]:f[o]=void 0===u[o]&&null!=e?e[o]:u[o];return arguments.length>2&&(f.children=arguments.length>3?n.call(arguments,2):t),m(l.type,f,i||l.key,r||l.ref,null)}function Q(n){function l(n){var u,t;return this.getChildContext||(u=new Set,(t={})[l.__c]=this,this.getChildContext=function(){return t},this.componentWillUnmount=function(){u=null},this.shouldComponentUpdate=function(n){this.props.value!=n.value&&u.forEach(function(n){n.__e=!0,M(n)})},this.sub=function(n){u.add(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){u&&u.delete(n),l&&l.call(n)}}),n.children}return l.__c="__cC"+h++,l.__=n,l.Provider=l.__l=(l.Consumer=function(n,l){return n.children(l)}).contextType=l,l}n=v.slice,l={__e:function(n,l,u,t){for(var i,r,o;l=l.__;)if((i=l.__c)&&!i.__)try{if((r=i.constructor)&&null!=r.getDerivedStateFromError&&(i.setState(r.getDerivedStateFromError(n)),o=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),o=i.__d),o)return i.__E=i}catch(l){n=l}throw n}},u=0,t=function(n){return null!=n&&null==n.constructor},x.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!=this.state?this.__s:this.__s=d({},this.state),"function"==typeof n&&(n=n(d({},u),this.props)),n&&d(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),M(this))},x.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),M(this))},x.prototype.render=k,i=[],o="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,e=function(n,l){return n.__v.__b-l.__v.__b},$.__r=0,f=/(PointerCapture)$|Capture$/i,c=0,s=F(!1),a=F(!0),h=0;
//# sourceMappingURL=preact.module.js.map


/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GridApp: () => (/* binding */ GridApp)
/* harmony export */ });
/* harmony import */ var preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var preact_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);
/* harmony import */ var _BqTable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(5);
/* harmony import */ var _pagination__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(7);




function GridApp() {
    const [view, setView] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)({ kind: 'idle' });
    (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        function onMessage(ev) {
            const msg = ev.data;
            if (!msg || !msg.requestType) {
                return;
            }
            switch (msg.requestType) {
                case 'clear':
                    setView({ kind: 'idle' });
                    break;
                case 'error':
                    setView({
                        kind: 'error',
                        message: String(msg.error?.message ?? 'Unknown error'),
                        reason: (msg.error?.reason ?? null),
                    });
                    break;
                case 'execute_query':
                    setView({ kind: 'loading', message: 'Loading results…' });
                    handleExecuteQuery(msg).then(setView).catch(e => setView({ kind: 'error', message: String(e?.message || e), reason: null }));
                    break;
                case 'preview_table':
                    setView({ kind: 'loading', message: 'Loading table…' });
                    handlePreviewTable(msg).then(setView).catch(e => setView({ kind: 'error', message: String(e?.message || e), reason: null }));
                    break;
                default:
                    break;
            }
        }
        window.addEventListener('message', onMessage);
        try {
            const api = window.__bqVscode;
            if (api && typeof api.postMessage === 'function') {
                api.postMessage({ command: 'load_complete' });
            }
        }
        catch { /* ignore */ }
        return () => window.removeEventListener('message', onMessage);
    }, []);
    if (view.kind === 'idle') {
        return (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-empty", children: "No results yet." });
    }
    if (view.kind === 'loading') {
        return (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-notice", children: view.message || 'Loading…' });
    }
    if (view.kind === 'error') {
        return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-error-panel", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-error-title", children: "Query Error" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-error-msg", children: view.message }), view.reason && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-error-reason", children: ["Reason: ", view.reason] })] }));
    }
    if (view.tables.length === 1) {
        const t = view.tables[0];
        return (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(BqTableHost, { view: t }, t.key);
    }
    return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-script", children: view.tables.map(t => ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-script-item", children: (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(BqTableHost, { view: t }) }, t.key))) }));
}
function BqTableHost({ view }) {
    const { source, token } = view;
    const fetchRows = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useCallback)((start, size) => {
        if (source.kind === 'job') {
            return (0,_pagination__WEBPACK_IMPORTED_MODULE_3__.fetchPage)(source.jobRef, token, start, size);
        }
        return (0,_pagination__WEBPACK_IMPORTED_MODULE_3__.fetchTablePage)(source.tableRef, token, start, size);
    }, [source, token]);
    return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_BqTable__WEBPACK_IMPORTED_MODULE_2__.BqTable, { fetchRows: fetchRows, exportRef: view.exportRef, schema: view.schema, totalRows: view.totalRows, initialRows: view.initialRows, title: view.title, dmlStats: view.dmlStats, statementType: view.statementType }));
}
function jobRefFromJob(job, fallbackProjectId) {
    const ref = job.jobReference || job.metadata?.jobReference || {};
    return {
        projectId: String(ref.projectId || fallbackProjectId),
        jobId: String(ref.jobId || job.id),
        location: ref.location,
    };
}
async function handleExecuteQuery(msg) {
    const job = msg.job;
    const token = msg.token;
    const projectId = msg.projectId;
    if (!job || !token || !projectId) {
        return { kind: 'error', message: 'Missing job, token, or projectId in message payload.', reason: null };
    }
    const jobRef = jobRefFromJob(job, projectId);
    if (!jobRef.jobId) {
        return { kind: 'error', message: 'Missing jobId.', reason: null };
    }
    const hasScript = (job.statistics?.scriptStatistics || job.metadata?.statistics?.scriptStatistics) != null;
    if (hasScript) {
        const children = await (0,_pagination__WEBPACK_IMPORTED_MODULE_3__.fetchChildJobs)(jobRef, String(token));
        if (children.length === 0) {
            return { kind: 'error', message: 'Script has no child jobs with results.', reason: null };
        }
        const tables = [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            try {
                const res = await (0,_pagination__WEBPACK_IMPORTED_MODULE_3__.fetchPage)(child.jobRef, String(token), 0, _pagination__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_PAGE_SIZE);
                tables.push({
                    key: `child-${child.jobRef.jobId}`,
                    exportRef: { jobReference: child.jobRef },
                    schema: (res.schema?.fields || []),
                    totalRows: parseInt(String(res.totalRows || '0'), 10),
                    initialRows: res.rows || [],
                    token: String(token),
                    source: { kind: 'job', jobRef: child.jobRef },
                    title: `Statement ${i + 1}${child.statementType ? ` · ${child.statementType}` : ''}`,
                    dmlStats: child.dmlStats,
                    statementType: child.statementType,
                });
            }
            catch (e) {
                // skip failed child
            }
        }
        if (tables.length === 0) {
            return { kind: 'error', message: 'Script child jobs returned no results.', reason: null };
        }
        return { kind: 'tables', tables };
    }
    const res = await (0,_pagination__WEBPACK_IMPORTED_MODULE_3__.fetchPage)(jobRef, String(token), 0, _pagination__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_PAGE_SIZE);
    const jobStats = job.statistics?.query || job.metadata?.statistics?.query || {};
    return {
        kind: 'tables',
        tables: [{
                key: `job-${jobRef.jobId}`,
                exportRef: { jobReference: jobRef },
                schema: (res.schema?.fields || []),
                totalRows: parseInt(String(res.totalRows || '0'), 10),
                initialRows: res.rows || [],
                dmlStats: jobStats.dmlStats,
                statementType: jobStats.statementType,
                token: String(token),
                source: { kind: 'job', jobRef },
            }],
    };
}
async function handlePreviewTable(msg) {
    const token = msg.token;
    const projectId = msg.projectId;
    const datasetId = msg.datasetId;
    const tableId = msg.tableId;
    if (!token || !projectId || !datasetId || !tableId) {
        return { kind: 'error', message: 'Missing projectId, datasetId, tableId, or token.', reason: null };
    }
    const tableRef = { projectId, datasetId, tableId };
    const meta = await (0,_pagination__WEBPACK_IMPORTED_MODULE_3__.fetchTableMetadata)(tableRef, String(token));
    const schema = (meta.schema?.fields || []);
    const totalRows = parseInt(String(meta.numRows || '0'), 10);
    const rowsRes = totalRows > 0
        ? await (0,_pagination__WEBPACK_IMPORTED_MODULE_3__.fetchTablePage)(tableRef, String(token), 0, _pagination__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_PAGE_SIZE)
        : { rows: [] };
    return {
        kind: 'tables',
        tables: [{
                key: `table-${projectId}.${datasetId}.${tableId}`,
                exportRef: { tableReference: tableRef },
                schema,
                totalRows,
                initialRows: rowsRes.rows || [],
                token: String(token),
                source: { kind: 'table', tableRef },
                title: `${projectId}.${datasetId}.${tableId}`,
            }],
    };
}


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   useCallback: () => (/* binding */ q),
/* harmony export */   useContext: () => (/* binding */ x),
/* harmony export */   useDebugValue: () => (/* binding */ P),
/* harmony export */   useEffect: () => (/* binding */ y),
/* harmony export */   useErrorBoundary: () => (/* binding */ b),
/* harmony export */   useId: () => (/* binding */ g),
/* harmony export */   useImperativeHandle: () => (/* binding */ F),
/* harmony export */   useLayoutEffect: () => (/* binding */ _),
/* harmony export */   useMemo: () => (/* binding */ T),
/* harmony export */   useReducer: () => (/* binding */ h),
/* harmony export */   useRef: () => (/* binding */ A),
/* harmony export */   useState: () => (/* binding */ d)
/* harmony export */ });
/* harmony import */ var preact__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
var t,r,u,i,o=0,f=[],c=preact__WEBPACK_IMPORTED_MODULE_0__.options,e=c.__b,a=c.__r,v=c.diffed,l=c.__c,m=c.unmount,s=c.__;function p(n,t){c.__h&&c.__h(r,n,o||t),o=0;var u=r.__H||(r.__H={__:[],__h:[]});return n>=u.__.length&&u.__.push({}),u.__[n]}function d(n){return o=1,h(D,n)}function h(n,u,i){var o=p(t++,2);if(o.t=n,!o.__c&&(o.__=[i?i(u):D(void 0,u),function(n){var t=o.__N?o.__N[0]:o.__[0],r=o.t(t,n);t!==r&&(o.__N=[r,o.__[1]],o.__c.setState({}))}],o.__c=r,!r.__f)){var f=function(n,t,r){if(!o.__c.__H)return!0;var u=o.__c.__H.__.filter(function(n){return!!n.__c});if(u.every(function(n){return!n.__N}))return!c||c.call(this,n,t,r);var i=o.__c.props!==n;return u.forEach(function(n){if(n.__N){var t=n.__[0];n.__=n.__N,n.__N=void 0,t!==n.__[0]&&(i=!0)}}),c&&c.call(this,n,t,r)||i};r.__f=!0;var c=r.shouldComponentUpdate,e=r.componentWillUpdate;r.componentWillUpdate=function(n,t,r){if(this.__e){var u=c;c=void 0,f(n,t,r),c=u}e&&e.call(this,n,t,r)},r.shouldComponentUpdate=f}return o.__N||o.__}function y(n,u){var i=p(t++,3);!c.__s&&C(i.__H,u)&&(i.__=n,i.u=u,r.__H.__h.push(i))}function _(n,u){var i=p(t++,4);!c.__s&&C(i.__H,u)&&(i.__=n,i.u=u,r.__h.push(i))}function A(n){return o=5,T(function(){return{current:n}},[])}function F(n,t,r){o=6,_(function(){if("function"==typeof n){var r=n(t());return function(){n(null),r&&"function"==typeof r&&r()}}if(n)return n.current=t(),function(){return n.current=null}},null==r?r:r.concat(n))}function T(n,r){var u=p(t++,7);return C(u.__H,r)&&(u.__=n(),u.__H=r,u.__h=n),u.__}function q(n,t){return o=8,T(function(){return n},t)}function x(n){var u=r.context[n.__c],i=p(t++,9);return i.c=n,u?(null==i.__&&(i.__=!0,u.sub(r)),u.props.value):n.__}function P(n,t){c.useDebugValue&&c.useDebugValue(t?t(n):n)}function b(n){var u=p(t++,10),i=d();return u.__=n,r.componentDidCatch||(r.componentDidCatch=function(n,t){u.__&&u.__(n,t),i[1](n)}),[i[0],function(){i[1](void 0)}]}function g(){var n=p(t++,11);if(!n.__){for(var u=r.__v;null!==u&&!u.__m&&null!==u.__;)u=u.__;var i=u.__m||(u.__m=[0,0]);n.__="P"+i[0]+"-"+i[1]++}return n.__}function j(){for(var n;n=f.shift();)if(n.__P&&n.__H)try{n.__H.__h.forEach(z),n.__H.__h.forEach(B),n.__H.__h=[]}catch(t){n.__H.__h=[],c.__e(t,n.__v)}}c.__b=function(n){r=null,e&&e(n)},c.__=function(n,t){n&&t.__k&&t.__k.__m&&(n.__m=t.__k.__m),s&&s(n,t)},c.__r=function(n){a&&a(n),t=0;var i=(r=n.__c).__H;i&&(u===r?(i.__h=[],r.__h=[],i.__.forEach(function(n){n.__N&&(n.__=n.__N),n.u=n.__N=void 0})):(i.__h.forEach(z),i.__h.forEach(B),i.__h=[],t=0)),u=r},c.diffed=function(n){v&&v(n);var t=n.__c;t&&t.__H&&(t.__H.__h.length&&(1!==f.push(t)&&i===c.requestAnimationFrame||((i=c.requestAnimationFrame)||w)(j)),t.__H.__.forEach(function(n){n.u&&(n.__H=n.u),n.u=void 0})),u=r=null},c.__c=function(n,t){t.some(function(n){try{n.__h.forEach(z),n.__h=n.__h.filter(function(n){return!n.__||B(n)})}catch(r){t.some(function(n){n.__h&&(n.__h=[])}),t=[],c.__e(r,n.__v)}}),l&&l(n,t)},c.unmount=function(n){m&&m(n);var t,r=n.__c;r&&r.__H&&(r.__H.__.forEach(function(n){try{z(n)}catch(n){t=n}}),r.__H=void 0,t&&c.__e(t,r.__v))};var k="function"==typeof requestAnimationFrame;function w(n){var t,r=function(){clearTimeout(u),k&&cancelAnimationFrame(t),setTimeout(n)},u=setTimeout(r,35);k&&(t=requestAnimationFrame(r))}function z(n){var t=r,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r=t}function B(n){var t=r;n.__c=n.__(),r=t}function C(n,t){return!n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}function D(n,t){return"function"==typeof t?t(n):t}
//# sourceMappingURL=hooks.module.js.map


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BqTable: () => (/* binding */ BqTable)
/* harmony export */ });
/* harmony import */ var preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var preact_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);
/* harmony import */ var _cellFormatters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6);
/* harmony import */ var _pagination__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(7);




const NUMERIC_TYPES = new Set(['INT64', 'INTEGER', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC']);
function isNumericType(t) {
    return NUMERIC_TYPES.has(t.toUpperCase());
}
function showToast(msg) {
    let el = document.querySelector('.bq-toast');
    if (!el) {
        el = document.createElement('div');
        el.className = 'bq-toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    window.clearTimeout(el._t);
    el._t = window.setTimeout(() => el.classList.remove('show'), 1200);
}
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied');
    }
    catch {
        showToast('Copy failed');
    }
}
function valueToCopyText(v, _col) {
    if (v === null || v === undefined) {
        return '';
    }
    if (typeof v === 'object') {
        try {
            return JSON.stringify(v);
        }
        catch {
            return String(v);
        }
    }
    return String(v);
}
function compareValues(a, b) {
    if (a == null && b == null) {
        return 0;
    }
    if (a == null) {
        return 1;
    }
    if (b == null) {
        return -1;
    }
    const an = parseFloat(String(a));
    const bn = parseFloat(String(b));
    if (!isNaN(an) && !isNaN(bn) && String(a).trim() !== '' && String(b).trim() !== '') {
        return an - bn;
    }
    return String(a).localeCompare(String(b));
}
function highlightMatch(text, needle) {
    if (!needle) {
        return escapeHtml(text);
    }
    const safe = escapeHtml(text);
    const safeNeedle = escapeHtml(needle);
    const re = new RegExp(safeNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return safe.replace(re, m => `<mark class="bq-mark">${m}</mark>`);
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function prettyPrint(v) {
    if (v === null || v === undefined) {
        return 'NULL';
    }
    if (typeof v === 'object') {
        try {
            return JSON.stringify(v, null, 2);
        }
        catch {
            return String(v);
        }
    }
    return String(v);
}
function BqTable({ fetchRows, exportRef, schema, totalRows, initialRows, title, dmlStats, statementType }) {
    const columns = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => (0,_cellFormatters__WEBPACK_IMPORTED_MODULE_2__.flattenSchema)(schema), [schema]);
    const [pageSize, setPageSize] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(_pagination__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_PAGE_SIZE);
    const [pageIndex, setPageIndex] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(0);
    const [rows, setRows] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(initialRows);
    const [loading, setLoading] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [err, setErr] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [sorts, setSorts] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
    const [density, setDensity] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)('cozy');
    const [find, setFind] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)('');
    const [tab, setTab] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)('results');
    const [drawer, setDrawer] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [colWidths, setColWidths] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)({});
    const [selected, setSelected] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(new Set());
    const [lastClickedIdx, setLastClickedIdx] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [ctxMenu, setCtxMenu] = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        let cancelled = false;
        if (pageIndex === 0 && pageSize === _pagination__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_PAGE_SIZE && rows === initialRows) {
            return () => { cancelled = true; };
        }
        setLoading(true);
        setErr(null);
        fetchRows(pageIndex * pageSize, pageSize)
            .then(res => {
            if (cancelled) {
                return;
            }
            setRows(res.rows || []);
            setSelected(new Set());
            setLoading(false);
        })
            .catch(e => {
            if (cancelled) {
                return;
            }
            setErr(e instanceof Error ? e.message : String(e));
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [fetchRows, pageIndex, pageSize]);
    const extracted = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => rows.map(r => {
        const obj = {};
        for (const c of columns) {
            obj[c.key] = (0,_cellFormatters__WEBPACK_IMPORTED_MODULE_2__.extractRowValue)(r, schema, c.path);
        }
        return obj;
    }), [rows, columns, schema]);
    const filteredIndices = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
        const base = extracted.map((_, i) => i);
        if (!find.trim()) {
            return base;
        }
        const needle = find.toLowerCase();
        return base.filter(i => {
            for (const c of columns) {
                const v = extracted[i][c.key];
                if (v === null || v === undefined) {
                    continue;
                }
                const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
                if (s.toLowerCase().includes(needle)) {
                    return true;
                }
            }
            return false;
        });
    }, [extracted, columns, find]);
    const sortedIndices = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
        if (sorts.length === 0) {
            return filteredIndices;
        }
        const idx = filteredIndices.slice();
        idx.sort((a, b) => {
            for (const s of sorts) {
                const c = compareValues(extracted[a][s.colKey], extracted[b][s.colKey]) * s.dir;
                if (c !== 0) {
                    return c;
                }
            }
            return 0;
        });
        return idx;
    }, [extracted, filteredIndices, sorts]);
    function onHeaderClick(col, e) {
        const additive = e.shiftKey;
        setSorts(prev => {
            const existing = prev.find(s => s.colKey === col.key);
            if (additive) {
                if (!existing) {
                    return [...prev, { colKey: col.key, dir: 1 }];
                }
                if (existing.dir === 1) {
                    return prev.map(s => s.colKey === col.key ? { ...s, dir: -1 } : s);
                }
                return prev.filter(s => s.colKey !== col.key);
            }
            if (!existing) {
                return [{ colKey: col.key, dir: 1 }];
            }
            if (prev.length > 1 || existing.dir === -1) {
                return [{ colKey: col.key, dir: 1 }];
            }
            return [{ colKey: col.key, dir: -1 }];
        });
    }
    function sortInfo(col) {
        const i = sorts.findIndex(s => s.colKey === col.key);
        if (i < 0) {
            return null;
        }
        return { rank: i + 1, dir: sorts[i].dir };
    }
    function onRowClick(rowIdx, e) {
        if (e.target.closest('td.bq-rownum') === null) {
            return;
        }
        e.preventDefault();
        setSelected(prev => {
            const next = new Set(prev);
            if (e.shiftKey && lastClickedIdx !== null) {
                const order = sortedIndices;
                const a = order.indexOf(lastClickedIdx);
                const b = order.indexOf(rowIdx);
                if (a >= 0 && b >= 0) {
                    const [lo, hi] = a < b ? [a, b] : [b, a];
                    for (let k = lo; k <= hi; k++) {
                        next.add(order[k]);
                    }
                }
            }
            else if (e.metaKey || e.ctrlKey) {
                if (next.has(rowIdx)) {
                    next.delete(rowIdx);
                }
                else {
                    next.add(rowIdx);
                }
            }
            else {
                next.clear();
                next.add(rowIdx);
            }
            return next;
        });
        setLastClickedIdx(rowIdx);
    }
    function formatRows(indices, format) {
        const header = columns.map(c => c.label);
        if (format === 'json') {
            const objs = indices.map(i => {
                const obj = {};
                for (const c of columns) {
                    obj[c.label] = extracted[i][c.key];
                }
                return obj;
            });
            return JSON.stringify(objs.length === 1 ? objs[0] : objs, null, 2);
        }
        const body = indices.map(i => columns.map(c => valueToCopyText(extracted[i][c.key], c)));
        if (format === 'tsv') {
            return [header.join('\t'), ...body.map(r => r.join('\t'))].join('\n');
        }
        const sep = '| ' + header.map(() => '---').join(' | ') + ' |';
        return [
            '| ' + header.join(' | ') + ' |',
            sep,
            ...body.map(r => '| ' + r.map(c => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |'),
        ].join('\n');
    }
    function copySelected(format) {
        const indices = sortedIndices.filter(i => selected.has(i));
        if (indices.length === 0) {
            showToast('No rows selected');
            return;
        }
        copyText(formatRows(indices, format));
    }
    function copyRow(rowIdx, format) {
        copyText(formatRows([rowIdx], format));
    }
    function onRowContextMenu(rowIdx, col, e) {
        e.preventDefault();
        e.stopPropagation();
        if (!selected.has(rowIdx)) {
            setSelected(new Set([rowIdx]));
            setLastClickedIdx(rowIdx);
        }
        setCtxMenu({ x: e.clientX, y: e.clientY, rowIdx, col });
    }
    (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        if (!ctxMenu) {
            return;
        }
        function close() { setCtxMenu(null); }
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', close);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', close);
        };
    }, [ctxMenu]);
    const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
    const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);
    const densityVars = {
        compact: { padY: '2px', font: '0.82em' },
        cozy: { padY: '5px', font: '0.88em' },
        comfy: { padY: '9px', font: '0.92em' },
    };
    const cssVars = {
        ['--bq-cell-pad-y']: densityVars[density].padY,
        ['--bq-cell-font']: densityVars[density].font,
    };
    const dmlParts = [];
    if (dmlStats?.insertedRowCount && dmlStats.insertedRowCount !== '0') {
        dmlParts.push(`${Number(dmlStats.insertedRowCount).toLocaleString()} inserted`);
    }
    if (dmlStats?.updatedRowCount && dmlStats.updatedRowCount !== '0') {
        dmlParts.push(`${Number(dmlStats.updatedRowCount).toLocaleString()} updated`);
    }
    if (dmlStats?.deletedRowCount && dmlStats.deletedRowCount !== '0') {
        dmlParts.push(`${Number(dmlStats.deletedRowCount).toLocaleString()} deleted`);
    }
    const showDml = dmlParts.length > 0 || (statementType && ['INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(statementType));
    return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-root", style: cssVars, children: [title && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-title", children: title }), showDml && ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-dml-summary", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-dml-type", children: statementType || 'DML' }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-dml-counts", children: dmlParts.length ? dmlParts.join(' · ') : '0 rows affected' })] })), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-controls", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-tabs", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: `bq-tab ${tab === 'results' ? 'active' : ''}`, onClick: () => setTab('results'), children: "Results" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("button", { class: `bq-tab ${tab === 'schema' ? 'active' : ''}`, onClick: () => setTab('schema'), children: ["Schema ", (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-count", children: columns.length })] })] }), tab === 'results' && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", disabled: pageIndex === 0 || loading, onClick: () => setPageIndex(0), title: "First page", children: "\u00AB" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", disabled: pageIndex === 0 || loading, onClick: () => setPageIndex(p => Math.max(0, p - 1)), title: "Previous page", children: "\u2039" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-pg-label", children: "Page" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { class: "bq-pg-input", type: "number", min: 1, max: totalPages, value: pageIndex + 1, onChange: (e) => {
                                    const n = parseInt(e.currentTarget.value, 10);
                                    if (!isNaN(n)) {
                                        setPageIndex(Math.max(0, Math.min(totalPages - 1, n - 1)));
                                    }
                                } }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { class: "bq-pg-of", children: ["of ", totalPages.toLocaleString()] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", disabled: pageIndex >= totalPages - 1 || loading, onClick: () => setPageIndex(p => Math.min(totalPages - 1, p + 1)), title: "Next page", children: "\u203A" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", disabled: pageIndex >= totalPages - 1 || loading, onClick: () => setPageIndex(totalPages - 1), title: "Last page", children: "\u00BB" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { class: "bq-pg-info", children: [startRow.toLocaleString(), "-", endRow.toLocaleString(), " / ", totalRows.toLocaleString()] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("select", { class: "bq-pg-size", value: pageSize, onChange: (e) => { setPageSize(parseInt(e.currentTarget.value, 10)); setPageIndex(0); }, title: "Rows per page", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: 25, children: "25" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: 50, children: "50" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: 100, children: "100" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: 250, children: "250" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: 1000, children: "1000" })] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-find", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { class: "bq-find-input", type: "search", placeholder: "Find\u2026", value: find, onInput: (e) => setFind(e.currentTarget.value), title: "Filter current page" }), find && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-find-count", children: filteredIndices.length })] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-density", title: "Row density", children: ['compact', 'cozy', 'comfy'].map(d => ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: `bq-density-btn ${density === d ? 'active' : ''}`, onClick: () => setDensity(d), title: d, children: d === 'compact' ? '≡' : d === 'cozy' ? '☰' : '⋯' }))) }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-export", children: [selected.size > 0 && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { class: "bq-sel-count", children: [selected.size, " sel"] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => copySelected('tsv'), title: "Copy selected rows as TSV", children: "TSV" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => copySelected('md'), title: "Copy selected rows as Markdown", children: "MD" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => copySelected('json'), title: "Copy selected rows as JSON", children: "JSON" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => setSelected(new Set()), title: "Clear selection", children: "\u2715" })] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => postExport('download_csv', exportRef), title: "Download all as CSV", children: "CSV" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => postExport('download_jsonl', exportRef), title: "Download all as JSONL", children: "JSONL" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => postExport('send_pubsub', exportRef), title: "Send to Pub/Sub", children: "Pub/Sub" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => postExport('copy_to_clipboard', exportRef), title: "Copy all as Markdown", children: "Copy" })] })] })] }), loading && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-notice", children: "Loading rows\u2026" }), err && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-error", children: err }), tab === 'schema' ? ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(SchemaPane, { columns: columns })) : ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: `bq-layout ${drawer ? 'with-drawer' : ''}`, children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-scroll", children: (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("table", { class: "bq-grid", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("thead", { children: (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("tr", { children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("th", { class: "bq-rownum", title: "Row", children: "#" }), columns.map(col => {
                                                const info = sortInfo(col);
                                                const style = colWidths[col.key] ? { width: colWidths[col.key] + 'px', minWidth: colWidths[col.key] + 'px' } : undefined;
                                                return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("th", { style: style, onClick: (e) => onHeaderClick(col, e), title: `${col.label} · ${col.type}${col.mode !== 'NULLABLE' ? ' · ' + col.mode : ''} · Click to sort, Shift+click for multi-sort`, children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-col-name", children: col.label }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-col-type", children: col.mode === 'REPEATED' ? col.type + '[]' : col.type }), info && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { class: "bq-sort", children: [info.dir === 1 ? '▲' : '▼', sorts.length > 1 ? (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("sub", { class: "bq-sort-rank", children: info.rank }) : null] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(ResizeHandle, { onResize: w => setColWidths(cw => ({ ...cw, [col.key]: w })) })] }));
                                            })] }) }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("tbody", { children: sortedIndices.map((i, displayIdx) => ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("tr", { class: selected.has(i) ? 'bq-selected' : '', onClick: (e) => onRowClick(i, e), onContextMenu: (e) => onRowContextMenu(i, undefined, e), children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("td", { class: "bq-rownum", onContextMenu: (e) => onRowContextMenu(i, undefined, e), children: startRow + displayIdx }), columns.map(col => {
                                                const v = extracted[i][col.key];
                                                const { html, isNull } = (0,_cellFormatters__WEBPACK_IMPORTED_MODULE_2__.renderCellValue)(v, col);
                                                const classes = [
                                                    isNull ? 'bq-null' : '',
                                                    isNumericType(col.type) ? 'bq-numeric' : 'bq-cell-max',
                                                    `bq-t-${col.type.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                                                ].filter(Boolean).join(' ');
                                                const display = isNull
                                                    ? 'NULL'
                                                    : (find ? highlightMatch(typeof v === 'object' ? JSON.stringify(v) : String(v), find) : html);
                                                const canExpand = typeof v === 'object' && v !== null;
                                                return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("td", { class: classes, title: isNull ? 'NULL' : valueToCopyText(v, col), onContextMenu: (e) => onRowContextMenu(i, col, e), onClick: (e) => {
                                                        e.stopPropagation();
                                                        if (canExpand) {
                                                            setDrawer({ col, value: v });
                                                            return;
                                                        }
                                                        copyText(valueToCopyText(v, col));
                                                    }, dangerouslySetInnerHTML: { __html: display } }));
                                            })] }))) })] }) }), drawer && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(CellDrawer, { col: drawer.col, value: drawer.value, onClose: () => setDrawer(null) })] })), ctxMenu && (() => {
                const selCount = selected.size;
                const multi = selCount > 1 && selected.has(ctxMenu.rowIdx);
                const label = multi ? `${selCount} rows` : `Row ${startRow + sortedIndices.indexOf(ctxMenu.rowIdx)}`;
                const doCopy = (fmt) => {
                    if (multi) {
                        copySelected(fmt);
                    }
                    else {
                        copyRow(ctxMenu.rowIdx, fmt);
                    }
                    setCtxMenu(null);
                };
                return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-ctx-menu", style: { left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }, onClick: (e) => e.stopPropagation(), onContextMenu: (e) => e.preventDefault(), children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-ctx-head", children: label }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("button", { class: "bq-ctx-item", onClick: () => doCopy('tsv'), children: ["Copy ", multi ? 'rows' : 'row', " (TSV)"] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("button", { class: "bq-ctx-item", onClick: () => doCopy('md'), children: ["Copy ", multi ? 'rows' : 'row', " (Markdown)"] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("button", { class: "bq-ctx-item", onClick: () => doCopy('json'), children: ["Copy ", multi ? 'rows' : 'row', " (JSON)"] }), ctxMenu.col && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-ctx-sep" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-ctx-item", onClick: () => { copyText(valueToCopyText(extracted[ctxMenu.rowIdx][ctxMenu.col.key], ctxMenu.col)); setCtxMenu(null); }, children: "Copy cell value" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-ctx-item", onClick: () => { copyText(ctxMenu.col.label); setCtxMenu(null); }, children: "Copy column name" })] }), multi && (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-ctx-sep" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-ctx-item", onClick: () => { setSelected(new Set()); setCtxMenu(null); }, children: "Clear selection" })] })] }));
            })()] }));
}
function SchemaPane({ columns }) {
    return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { class: "bq-scroll", children: (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("table", { class: "bq-grid bq-schema-grid", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("thead", { children: (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("tr", { children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("th", { class: "bq-rownum", children: "#" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("th", { children: "Name" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("th", { children: "Type" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("th", { children: "Mode" })] }) }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("tbody", { children: columns.map((c, i) => ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("tr", { children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("td", { class: "bq-rownum", children: i + 1 }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("td", { children: c.label }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("td", { children: (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-col-type", children: c.mode === 'REPEATED' ? c.type + '[]' : c.type }) }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("td", { class: "bq-muted", children: c.mode })] }))) })] }) }));
}
function CellDrawer({ col, value, onClose }) {
    const pretty = prettyPrint(value);
    return ((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("aside", { class: "bq-drawer", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-drawer-head", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-drawer-title", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: col.label }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { class: "bq-col-type", children: col.mode === 'REPEATED' ? col.type + '[]' : col.type })] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { class: "bq-drawer-actions", children: [(0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: () => copyText(pretty), title: "Copy value", children: "Copy" }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { class: "bq-pg-btn", onClick: onClose, title: "Close", children: "\u2715" })] })] }), (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("pre", { class: "bq-drawer-body", children: pretty })] }));
}
function ResizeHandle({ onResize }) {
    const ref = (0,preact_hooks__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
    function onDown(e) {
        e.stopPropagation();
        const th = (ref.current?.parentElement);
        if (!th) {
            return;
        }
        const startX = e.clientX;
        const startW = th.getBoundingClientRect().width;
        function move(ev) {
            const w = Math.max(60, startW + (ev.clientX - startX));
            onResize(w);
        }
        function up() {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        }
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }
    return (0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { ref: ref, class: "bq-resize", onMouseDown: onDown, onClick: (e) => e.stopPropagation() });
}
let vscodeApi = null;
function vs() {
    if (!vscodeApi) {
        vscodeApi = window.__bqVscode || acquireVsCodeApi();
        window.__bqVscode = vscodeApi;
    }
    return vscodeApi;
}
function postExport(command, ref) {
    const payload = { command };
    if (ref.jobReference) {
        payload.job_reference = {
            projectId: ref.jobReference.projectId,
            jobId: ref.jobReference.jobId,
            location: ref.jobReference.location,
        };
    }
    if (ref.tableReference) {
        payload.table_reference = {
            projectId: ref.tableReference.projectId,
            datasetId: ref.tableReference.datasetId,
            tableId: ref.tableReference.tableId,
        };
    }
    vs().postMessage(payload);
}


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   decodeBqValue: () => (/* binding */ decodeBqValue),
/* harmony export */   escapeHtml: () => (/* binding */ escapeHtml),
/* harmony export */   extractRowValue: () => (/* binding */ extractRowValue),
/* harmony export */   flattenSchema: () => (/* binding */ flattenSchema),
/* harmony export */   formatScalar: () => (/* binding */ formatScalar),
/* harmony export */   renderCellValue: () => (/* binding */ renderCellValue)
/* harmony export */ });
function formatScalar(raw, type) {
    if (raw === null || raw === undefined) {
        return null;
    }
    const t = (type || '').toUpperCase();
    switch (t) {
        case 'TIMESTAMP': {
            const ms = Math.round(parseFloat(String(raw)) * 1000);
            if (!isFinite(ms)) {
                return String(raw);
            }
            return new Date(ms).toISOString();
        }
        case 'DATE':
        case 'DATETIME':
        case 'TIME':
        case 'STRING':
        case 'BYTES':
        case 'GEOGRAPHY':
            return String(raw);
        case 'INT64':
        case 'INTEGER':
        case 'NUMERIC':
        case 'BIGNUMERIC':
        case 'FLOAT':
        case 'FLOAT64':
            return String(raw);
        case 'BOOL':
        case 'BOOLEAN':
            return String(raw) === 'true' ? 'true' : 'false';
        case 'JSON':
            return typeof raw === 'string' ? raw : JSON.stringify(raw);
        default:
            return String(raw);
    }
}
function flattenSchema(fields, parentPath = [], parentLabel = '') {
    const out = [];
    for (const f of fields) {
        const path = [...parentPath, f.name];
        const label = parentLabel ? `${parentLabel}.${f.name}` : f.name;
        const type = (f.type || 'STRING').toUpperCase();
        const mode = (f.mode || 'NULLABLE').toUpperCase();
        if (type === 'RECORD' || type === 'STRUCT') {
            if (mode === 'REPEATED') {
                out.push({ key: path.join('.'), label, type, mode, path });
            }
            else if (f.fields && f.fields.length > 0) {
                out.push(...flattenSchema(f.fields, path, label));
            }
            else {
                out.push({ key: path.join('.'), label, type, mode, path });
            }
        }
        else {
            out.push({ key: path.join('.'), label, type, mode, path });
        }
    }
    return out;
}
/**
 * Decodes a BigQuery raw cell value into plain JS using the field schema.
 * BQ wire format wraps STRUCTs as { f: [{ v: cell }, ...] } and REPEATED as [{ v: item }, ...].
 * This peels those wrappers so nested records render as real objects/arrays.
 */
function decodeBqValue(raw, field) {
    if (raw === null || raw === undefined) {
        return null;
    }
    const type = (field.type || '').toUpperCase();
    const mode = (field.mode || 'NULLABLE').toUpperCase();
    if (mode === 'REPEATED') {
        if (!Array.isArray(raw)) {
            return raw;
        }
        const itemField = { ...field, mode: 'NULLABLE' };
        return raw.map((cell) => {
            const inner = cell && typeof cell === 'object' && 'v' in cell ? cell.v : cell;
            return decodeBqValue(inner, itemField);
        });
    }
    if (type === 'RECORD' || type === 'STRUCT') {
        if (!raw || !Array.isArray(raw.f)) {
            return raw;
        }
        const subs = field.fields || [];
        const obj = {};
        for (let i = 0; i < subs.length; i++) {
            const cell = raw.f[i];
            const sub = subs[i];
            obj[sub.name] = cell ? decodeBqValue(cell.v, sub) : null;
        }
        return obj;
    }
    return raw;
}
function extractRowValue(row, fields, path) {
    let cursor = row;
    let cursorFields = fields;
    for (let i = 0; i < path.length; i++) {
        const name = path[i];
        if (!cursorFields) {
            return undefined;
        }
        const idx = cursorFields.findIndex((f) => f.name === name);
        if (idx < 0) {
            return undefined;
        }
        const field = cursorFields[idx];
        const cellRaw = cursor && cursor.f ? cursor.f[idx] : undefined;
        const isLast = i === path.length - 1;
        if (!cellRaw) {
            return undefined;
        }
        if ((field.type || '').toUpperCase() === 'RECORD' || (field.type || '').toUpperCase() === 'STRUCT') {
            if ((field.mode || '').toUpperCase() === 'REPEATED') {
                if (isLast) {
                    return decodeBqValue(cellRaw.v, field);
                }
                return undefined;
            }
            if (isLast) {
                return decodeBqValue(cellRaw.v, field);
            }
            cursor = cellRaw.v;
            cursorFields = field.fields;
            continue;
        }
        return cellRaw.v;
    }
    return undefined;
}
function renderCellValue(value, col) {
    if (value === null || value === undefined) {
        return { html: 'NULL', isNull: true };
    }
    const type = col.type.toUpperCase();
    const mode = col.mode.toUpperCase();
    if (mode === 'REPEATED') {
        if (!Array.isArray(value)) {
            return { html: escapeHtml(JSON.stringify(value)), isNull: false };
        }
        const items = value.map((item) => {
            if (item === null || item === undefined) {
                return '<em>NULL</em>';
            }
            if (type === 'RECORD' || type === 'STRUCT' || typeof item === 'object') {
                return escapeHtml(JSON.stringify(item));
            }
            return escapeHtml(String(formatScalar(item, type) ?? ''));
        });
        return { html: `[ ${items.join(', ')} ]`, isNull: false };
    }
    if (type === 'RECORD' || type === 'STRUCT') {
        return { html: escapeHtml(JSON.stringify(value)), isNull: false };
    }
    const formatted = formatScalar(value, type);
    if (formatted === null) {
        return { html: 'NULL', isNull: true };
    }
    return { html: escapeHtml(formatted), isNull: false };
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_PAGE_SIZE: () => (/* binding */ DEFAULT_PAGE_SIZE),
/* harmony export */   fetchChildJobs: () => (/* binding */ fetchChildJobs),
/* harmony export */   fetchPage: () => (/* binding */ fetchPage),
/* harmony export */   fetchTableMetadata: () => (/* binding */ fetchTableMetadata),
/* harmony export */   fetchTablePage: () => (/* binding */ fetchTablePage)
/* harmony export */ });
const PAGE_SIZE = 50;
const BQ_BASE = 'https://bigquery.googleapis.com/bigquery/v2';
async function bqGet(url, token) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
    }
    return (await res.json());
}
async function fetchPage(jobRef, token, startIndex, pageSize = PAGE_SIZE) {
    const params = new URLSearchParams({
        maxResults: String(pageSize),
        startIndex: String(startIndex),
    });
    if (jobRef.location) {
        params.set('location', jobRef.location);
    }
    const url = `${BQ_BASE}/projects/${encodeURIComponent(jobRef.projectId)}/queries/${encodeURIComponent(jobRef.jobId)}?${params.toString()}`;
    return bqGet(url, token);
}
async function fetchTableMetadata(tableRef, token) {
    const url = `${BQ_BASE}/projects/${encodeURIComponent(tableRef.projectId)}/datasets/${encodeURIComponent(tableRef.datasetId)}/tables/${encodeURIComponent(tableRef.tableId)}`;
    return bqGet(url, token);
}
async function fetchTablePage(tableRef, token, startIndex, pageSize = PAGE_SIZE) {
    const params = new URLSearchParams({
        maxResults: String(pageSize),
        startIndex: String(startIndex),
    });
    const url = `${BQ_BASE}/projects/${encodeURIComponent(tableRef.projectId)}/datasets/${encodeURIComponent(tableRef.datasetId)}/tables/${encodeURIComponent(tableRef.tableId)}/data?${params.toString()}`;
    return bqGet(url, token);
}
async function fetchChildJobs(parent, token) {
    const params = new URLSearchParams({
        parentJobId: parent.jobId,
        projection: 'full',
        maxResults: '100',
    });
    if (parent.location) {
        params.set('location', parent.location);
    }
    const url = `${BQ_BASE}/projects/${encodeURIComponent(parent.projectId)}/jobs?${params.toString()}`;
    const res = await bqGet(url, token);
    const jobs = (res.jobs || []).filter((j) => {
        const t = j.statistics?.query?.statementType;
        if (!t) {
            return false;
        }
        return t === 'SELECT' || t === 'WITH' || t.startsWith('CREATE_') || t.startsWith('MERGE') || t === 'UPDATE' || t === 'INSERT' || t === 'DELETE';
    });
    return jobs.map((j) => ({
        jobRef: {
            projectId: j.jobReference.projectId,
            jobId: j.jobReference.jobId,
            location: j.jobReference.location,
        },
        statementType: j.statistics?.query?.statementType,
        dmlStats: j.statistics?.query?.dmlStats,
    }));
}
const DEFAULT_PAGE_SIZE = PAGE_SIZE;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var preact__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);
/* harmony import */ var _GridApp__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3);



function showFatal(msg) {
    try {
        const host = document.body || document.documentElement;
        const el = document.createElement('div');
        el.style.cssText = 'padding:12px;color:#f66;font-family:monospace;white-space:pre-wrap;';
        el.textContent = 'grid-v2 fatal: ' + msg;
        if (host) {
            host.appendChild(el);
        }
    }
    catch { /* ignore */ }
}
window.addEventListener('error', (ev) => showFatal(String(ev.error?.stack || ev.error?.message || ev.message)));
window.addEventListener('unhandledrejection', (ev) => showFatal('unhandledrejection: ' + String(ev.reason?.stack || ev.reason)));
try {
    window.__bqVscode = window.__bqVscode || acquireVsCodeApi();
    const mount = document.getElementById('q1');
    if (!mount) {
        showFatal('mount element #q1 not found');
    }
    else {
        (0,preact__WEBPACK_IMPORTED_MODULE_1__.render)((0,preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_GridApp__WEBPACK_IMPORTED_MODULE_2__.GridApp, {}), mount);
    }
}
catch (e) {
    showFatal(String(e?.stack || e?.message || e));
}

})();

/******/ })()
;
//# sourceMappingURL=grid-v2.js.map