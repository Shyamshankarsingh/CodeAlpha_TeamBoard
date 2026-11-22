/**
 * Safe DOM creation utility.
 * Never uses innerHTML or document.write. Sets textContent and attributes safely.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        el.addEventListener(eventName, value);
      } else if (key === 'className' || key === 'class') {
        el.className = value;
      } else if (key === 'dataset' && typeof value === 'object') {
        for (const [dataKey, dataValue] of Object.entries(value)) {
          el.dataset[dataKey] = dataValue;
        }
      } else if (key === 'disabled' || key === 'checked' || key === 'required') {
        if (value) {
          el.setAttribute(key, '');
          el[key] = true;
        } else {
          el.removeAttribute(key);
          el[key] = false;
        }
      } else if (value !== null && value !== undefined) {
        el.setAttribute(key, value);
      }
    }
  }

  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  return el;
}

export function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}
