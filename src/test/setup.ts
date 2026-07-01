import "@testing-library/jest-dom";

// Mock window.crypto for tests
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => "test-uuid-" + Math.random().toString(36).substr(2, 9),
  },
});

// Mock FileReader
global.FileReader = class MockFileReader {
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  result: string | ArrayBuffer | null = null;

  readAsDataURL(blob: Blob) {
    this.result = "data:image/jpeg;base64,mock-image-data";
    if (this.onloadend) {
      this.onloadend(new ProgressEvent("loadend"));
    }
  }
} as any;

// Mock window.location
delete (window as any).location;
window.location = {
  ...window.location,
  search: "",
  href: "http://localhost:3000/",
} as any;
