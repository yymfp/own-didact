/**
 * const element = (
 *  <div id="foo">
 *    <a>bar</a>
 *    <br/>
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

// 本次render提交的fiber树
let currentRoot = null;

// 递归遍历将fiber节点追加到dom中
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  // 记录本次render的fiber树
  currentRoot = wipRoot;
  // 处理完置空
  wipRoot = null;
}

const isEvent = (key) => key.startsWith("on");
const isProperty = (key) => key !== "children" && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);
function updateDom(dom, prevProps, nextProps) {
  // 删除或修改事件监听
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });
  // 添加事件监听
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });

  // 删除旧的属性
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[key] = "";
    });

  // 设置新的属性或者更新属性
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name];
    });
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  // 针对函数组件不存在dom 需要找到其包含dom的父节点
  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  // 找到父节点的dom
  const parentDom = domParentFiber.dom;
  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    parentDom.appendChild(fiber.dom);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, parentDom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom !== null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  }
  // 处理子节点
  commitWork(fiber.child);
  // 处理兄弟节点
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, parentDom) {
  // 针对函数组件不存在dom 需要找到存在dom的子节点 进行删除操作
  if (fiber.dom) {
    parentDom.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, parentDom);
  }
}

// 下一个任务
let nextUnitOfWork = null;

function workLoop(deadline) {
  // 空闲
  let shouldYield = false;
  // 存在下一个任务 且 有空闲时间
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);

    // 判断是否还有空闲时间
    shouldYield = deadline.timeRemaining() < 1;
  }

  // 如果不存在下个任务 并且 当前存在要render的fiber树
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

// 删除的节点列表
let deletions = null;

// 协调对比更新节点数据
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  // 找到旧的fiber
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;

  let prevSibling = null;

  // 构造以当前节点为root的fiber树
  while (index < elements.length || oldFiber != null) {
    const element = elements[index];

    let newFiber = null;

    // 对比新旧节点类型
    const sameType = oldFiber && element && element.type == oldFiber.type;

    if (sameType) {
      // 如果新旧节点类型一样 更新操作
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }

    if (element && !sameType) {
      // 如果存在新节点且新旧节点类型不一样 创建操作
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }

    if (oldFiber && !sameType) {
      // 如果有旧节点且类型不一样 删除操作
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    // 如果是第一个子节点 属于fiber孩子
    if (index === 0) {
      wipFiber.child = newFiber;
    } else {
      // 否则作为上一个节点的兄弟节点
      prevSibling.sibling = newFiber;
    }

    // 记录当前的节点
    prevSibling = newFiber;
    index++;
  }
}

// 执行当前任务 返回下一个任务（若有）
function performUnitOfWork(fiber) {
  // 添加dom节点
  // 创建新的fibers树
  // 返回下一个工作单元

  // 针对函数组件：不存在dom节点 且 子节点是通过运行函数返回的
  const isFunctionComponent = fiber.type instanceof Function;

  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  // 如果有子节点 返回子节点作为下一个渲染任务单元
  if (fiber.child) {
    return fiber.child;
  }

  let nextFiber = fiber;
  while (nextFiber) {
    // 遍历兄弟节点
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    // 寻找父节点的兄弟节点 直到根节点结束
    nextFiber = nextFiber.parent;
  }
}

let wipFiber = null;
let hookIndex = null;

function updateFunctionComponent(fiber) {
  // 用来存储当前组件的hooks 跟踪hookIndex （可以多次useState 所以用数组记录）
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  const children = [fiber.type(fiber.props)];
  
  reconcileChildren(fiber, children);
}

function useState(initial) {
  // 查找是否存在旧的hook
  const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [], // 多次执行setState
  }

  // 执行更新函数 返回最新的state
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(cb => {
    hook.state = typeof cb === 'function' ? cb(hook.state) : cb;
  });

  const setState = action => {
    // 将当前的更新函数存入
    hook.queue.push(action);

    // 重新设置任务
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  }

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
}

function createDom(fiber) {
  // 创建节点
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);
  return dom;
}

// 用于跟踪当前render的root
let wipRoot = null;

function Render(element, container) {
  // 设置fiber树的根节点
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot, // 记录旧的fiber树
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

const Didact = {
  createElement,
  createTextElement,
  Render,
  useState,
};

const container = document.querySelector("#root");

const element = Didact.createElement(
  "div",
  {
    id: "foo",
  },
  Didact.createElement("a", null, "bar"),
  Didact.createElement("br", null),
  Didact.createTextElement("hello")
);

console.log(element);

Didact.Render(element, container);
