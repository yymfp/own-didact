/**
 * const element = (
 *  <div id="foo">
 *    <a>bar</a>
 *    hello
 *  </div>
 * )
 */

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  };
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

function Render(element, container) {
  const dom = document.createElement(element.type);

  container.appendChild(dom);
}

const Didact = {
  createElement,
  Render,
};

const container = document.getElementById("root");

const element = Didact.createElement(
  "div",
  {
    id: "foo",
  },
  Didact.createElement("a", null, "bar"),
  Didact.createTextElement("hello")
);

Didact.Render(element, container);
