import React from 'react';
import { css } from '@emotion/css';
import cx from 'classnames';
import { SegmentAsync, SegmentInput, MenuItem, WithContextMenu, MenuGroup } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { unwrap } from './unwrap';
import { toSelectableValue } from './toSelectableValue';
import { AddButton } from './AddButton';

export type PartParams = Array<{
  value: string;
  options: (() => Promise<string[]>) | null;
}>;

type Props = {
  parts: Array<{
    name: string;
    params: PartParams;
  }>;
  getNewPartOptions: () => Promise<SelectableValue[]>;
  onChange: (partIndex: number, paramValues: string[]) => void;
  onRemovePart: (index: number) => void;
  onAddNewPart: (type: string) => void;
};

const renderRemovableNameMenuItems = (onClick: () => void) => {
  return (
    <MenuGroup label="" ariaLabel="">
      <MenuItem label="remove" ariaLabel="remove" onClick={onClick} />
    </MenuGroup>
  );
};

const RemovableName = ({ name, onRemove }: { name: string; onRemove: () => void }) => {
  return (
    <WithContextMenu renderMenuItems={() => renderRemovableNameMenuItems(onRemove)}>
      {({ openMenu }) => (
        <button className="gf-form-label" onClick={openMenu}>
          {name}
        </button>
      )}
    </WithContextMenu>
  );
};

type PartProps = {
  name: string;
  params: PartParams;
  onRemove: () => void;
  onChange: (paramValues: string[]) => void;
};

const noLeftPaddingClass = css({
  paddingLeft: '0',
});

const Part = ({ name, params, onChange, onRemove }: PartProps): JSX.Element => {
  const onParamChange = (par: string, i: number) => {
    const newParams = params.map((p) => p.value);
    newParams[i] = par;
    onChange(newParams);
  };
  return (
    <div className="gf-form-inline">
      <div className={cx('gf-form-label', noLeftPaddingClass)}>
        <RemovableName name={name} onRemove={onRemove} />(
        {params.map((p, i) => {
          const { value, options } = p;
          const isLast = i === params.length - 1;
          return (
            <React.Fragment key={i}>
              {options !== null ? (
                <SegmentAsync
                  allowCustomValue
                  value={value}
                  loadOptions={() => options().then((items) => items.map(toSelectableValue))}
                  onChange={(v) => {
                    onParamChange(unwrap(v.value), i);
                  }}
                />
              ) : (
                <SegmentInput
                  allowCustomValue
                  value={value}
                  onChange={(v) => {
                    onParamChange(v.toString(), i);
                  }}
                />
              )}
              {!isLast && ','}
            </React.Fragment>
          );
        })}
        )
      </div>
    </div>
  );
};

export const PartListSection = ({
  parts,
  getNewPartOptions,
  onAddNewPart,
  onRemovePart,
  onChange,
}: Props): JSX.Element => {
  return (
    <>
      {parts.map((part, index) => (
        <Part
          key={index}
          name={part.name}
          params={part.params}
          onRemove={() => {
            onRemovePart(index);
          }}
          onChange={(pars) => {
            onChange(index, pars);
          }}
        />
      ))}
      <AddButton loadOptions={getNewPartOptions} onAdd={onAddNewPart} />
    </>
  );
};
