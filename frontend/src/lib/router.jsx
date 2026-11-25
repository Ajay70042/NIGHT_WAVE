import React, { createContext, useContext, useState, useEffect } from "react";

const RouterContext = createContext({
  location: { pathname: "/", search: {} },
  navigate: () => {},
  historyBack: () => {},
});

export function RouterProvider({ children, initialPath = "/" }) {
  const [history, setHistory] = useState([{ pathname: initialPath, search: {} }]);
  const [index, setIndex] = useState(0);

  const current = history[index] || { pathname: "/", search: {} };

  const navigate = ({ to, search = {} }) => {
    const nextItem = { pathname: to, search: search || {} };
    const nextHistory = history.slice(0, index + 1).concat(nextItem);
    setHistory(nextHistory);
    setIndex(nextHistory.length - 1);
  };

  const historyBack = () => {
    if (index > 0) {
      setIndex(index - 1);
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <RouterContext.Provider value={{ location: current, navigate, historyBack }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useNavigate() {
  const { navigate } = useContext(RouterContext);
  return navigate;
}

export function useRouterState({ select } = {}) {
  const { location } = useContext(RouterContext);
  const state = { location };
  return select ? select(state) : state;
}

export function useRouter() {
  const { historyBack, navigate } = useContext(RouterContext);
  return {
    history: {
      back: historyBack,
    },
    navigate,
  };
}

export function Link({ to, search, children, className = "", ...props }) {
  const { navigate } = useContext(RouterContext);
  return (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        navigate({ to, search });
      }}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}
