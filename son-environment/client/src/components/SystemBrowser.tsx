/**
<ai_info>
This file defines the SystemBrowser component, which serves as the container
for browsing SON classes and their methods. It orchestrates the ClassList,
MethodList, and CodeViewer components, managing the selected class and method state.
It has been updated to include the actual CodeViewer component, replacing the placeholder.
</ai_info>
@file client/src/components/SystemBrowser.tsx
@description Container component for the SON System Browser interface.
Key features:
Manages the state for selectedClassName and selectedMethodSelector.
Renders the ClassList component.
Renders the MethodList component, passing necessary props.
Renders the CodeViewer component, passing selected class and method.
Uses Tailwind CSS for a multi-panel layout (Classes, Methods, Code).
@dependencies
React: useState.
./ClassList: Component to display the list of classes.
./MethodList: Component to display the list of methods for the selected class.
./CodeViewer: Component to display the source code for the selected method. // Added
./ui/Panel: Reusable panel component (optional, but used for structure).
@notes
Marked as a client component ("use client").
State is managed locally within this component for now.
The layout divides the browser into three main sections.
*/
"use client"; // Correct directive
import React, { useState } from 'react';
import ClassList from './ClassList';
import MethodList from './MethodList';
import CodeViewer from './CodeViewer'; // Import the CodeViewer component
import Panel from './ui/Panel'; // Optional panel component

/**
SystemBrowser Component
Provides the main interface for browsing SON classes and methods.
Contains ClassList, MethodList, and CodeViewer.
@returns {JSX.Element} The SystemBrowser component.
*/
export default function SystemBrowser(): JSX.Element {
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);
  // State for selected method - used by MethodList and CodeViewer
  const [selectedMethodSelector, setSelectedMethodSelector] = useState<string | null>(null);

  /**
  Handles the selection of a class from the ClassList component.
  Updates the selected class name state and resets the selected method.
  @param className - The name of the selected class.
  */
  const handleClassSelect = (className: string) => {
    console.log("SystemBrowser: Class selected:", className);
    // Only update if the class name actually changed to avoid unnecessary re-renders/fetches
    if (className !== selectedClassName) {
      setSelectedClassName(className);
      setSelectedMethodSelector(null); // Reset method selection when class changes
    }
  };

  /**
  Handles the selection of a method from the MethodList component.
  Updates the selected method selector state.
  @param selector - The selector of the selected method.
  */
  const handleMethodSelect = (selector: string) => {
    console.log("SystemBrowser: Method selected:", selector);
    setSelectedMethodSelector(selector);
  };

  return (
    // Main container for the browser, using flex column layout
    <div className="flex flex-col h-full space-y-2 p-2 bg-gray-100 dark:bg-gray-900">
      {/* Class List Panel */}
      <div className="flex-shrink-0 h-1/3 overflow-hidden">
        {/* Min height ensures visibility even if list is short initially */}
        <ClassList
          selectedClassName={selectedClassName}
          onClassSelect={handleClassSelect}
          className="h-full" // Make ClassList fill its container height
        />
      </div>

      {/* Method List Panel */}
      <div className="flex-shrink-0 h-1/3 overflow-hidden">
        {/* Render the actual MethodList component */}
        <MethodList
          selectedClassName={selectedClassName}
          selectedMethodSelector={selectedMethodSelector}
          onMethodSelect={handleMethodSelect}
          className="h-full" // Make MethodList fill its container height
        />
      </div>

      {/* Code Viewer Panel - Now renders the actual CodeViewer component */}
      <div className="flex-grow overflow-hidden">
         {/* Pass selected class/method to CodeViewer and make it fill height */}
         <CodeViewer
             className={selectedClassName}
             selector={selectedMethodSelector}
             classNameContainer="h-full"
          />
      </div>
    </div>
  )
}